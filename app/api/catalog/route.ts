import { NextRequest, NextResponse } from "next/server";

import { matchPhotoReferences, PHOTO_PROFILES, type AircraftSpecs } from "@/app/lib/photo-references";

export const dynamic = "force-dynamic";

type NinjasAircraft = {
  model?: string;
  length_ft?: string | number;
  wing_span_ft?: string | number;
  range_nautical_miles?: string | number;
  ceiling_ft?: string | number;
  max_speed_knots?: string | number;
  engine_type?: string;
};

function numberValue(value: string | number | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function enrichSpecs(
  query: { manufacturer: string; model: string },
  fallback: AircraftSpecs,
  apiKey: string,
) {
  const params = new URLSearchParams({ manufacturer: query.manufacturer, model: query.model, limit: "1" });
  const response = await fetch(`https://api.api-ninjas.com/v1/aircraft?${params}`, {
    headers: { "X-Api-Key": apiKey },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return { specs: fallback, enriched: false };
  const records = (await response.json()) as NinjasAircraft[];
  const record = records.find((item) => item.model?.toLowerCase().includes(query.model.toLowerCase()));
  if (!record) return { specs: fallback, enriched: false };
  const ceilingFt = fallback.ceilingFt ?? numberValue(record.ceiling_ft);
  const maxSpeedKt = fallback.maxSpeedKt ?? numberValue(record.max_speed_knots);
  return {
    enriched: ceilingFt !== fallback.ceilingFt || maxSpeedKt !== fallback.maxSpeedKt,
    specs: {
      ...fallback,
      ceilingFt,
      maxSpeedKt,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const image = form.get("image");
    const apiKey = process.env.API_NINJAS_KEY?.trim() ?? "";

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Upload an aircraft image before identifying it." }, { status: 400 });
    }
    if (!["image/jpeg", "image/png"].includes(image.type) || image.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Upload a JPG or PNG image smaller than 10 MB." }, { status: 400 });
    }

    const hashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", await image.arrayBuffer()));
    const sha256 = Array.from(hashBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    let hashes: string[] = [];
    try {
      const parsed: unknown = JSON.parse(String(form.get("hashes") ?? "[]"));
      if (Array.isArray(parsed)) hashes = parsed.filter((entry): entry is string => typeof entry === "string").slice(0, 2);
    } catch {
      // Exact photo matching remains available if perceptual hashes are missing.
    }
    const match = matchPhotoReferences(sha256, hashes);
    if (!match) {
      return NextResponse.json(
        {
          error: "No sufficiently similar reference photo. This build includes one reference photo.",
          code: "no_reference_match",
        },
        { status: 422 },
      );
    }

    const profile = PHOTO_PROFILES[match.profile];
    let specs = profile.specs;
    let specSource = "Curated aircraft type record";
    if (apiKey && match.profile !== "korean-air-777") {
      try {
        const enriched = await enrichSpecs(profile.apiQuery, profile.specs, apiKey);
        specs = enriched.specs;
        if (enriched.enriched) specSource = "API Ninjas Aircraft + curated aircraft type record";
      } catch {
        // Optional technical lookup cannot change the photo match.
      }
    }

    return NextResponse.json(
      {
        ...profile,
        confidence: Math.round(match.similarity * 100),
        evidence: [match.exact ? "Exact supplied image" : "Near-duplicate visual fingerprint", match.reference.label],
        specs,
        source: "Photo reference catalog",
        method: match.exact ? "Exact reference photo" : "Near-duplicate photo",
        sourceNotice: "Reference photo match — no location, ADS-B or live telemetry used",
        modelNotice: "The displayed percentage is photo-fingerprint similarity, not a calibrated classifier confidence. General aircraft recognition would require a separate validated model.",
        specSource,
        dataSources: ["Wikimedia Commons aircraft photo", "Aircraft type specifications", ...(specSource.startsWith("API Ninjas") ? ["API Ninjas Aircraft"] : []), "External photo/airframe verification"],
        recentFlights: [],
        recentFlightsNotice:
          "A still image cannot establish recent flights. Verify its registration and time against a licensed flight history provider; ADS-B remains disabled for uploads.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "The uploaded image could not be processed." }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Submit an image with POST for reference photo matching." },
    { status: 405, headers: { Allow: "POST" } },
  );
}
