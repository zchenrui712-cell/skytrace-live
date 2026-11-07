import { NextResponse } from "next/server";

import { AIRCRAFT_DATASETS } from "@/app/lib/aircraft-datasets";
import { REFERENCE_PHOTOS } from "@/app/lib/photo-references";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      runtime: {
        liveMatching: "camera azimuth + elevation + field of view + live ADS-B candidates",
        uploadMatching: "exact SHA-256 or near-duplicate perceptual fingerprint of the included reference; abstains on unfamiliar photos",
        apiNinjasConfigured: Boolean(process.env.API_NINJAS_KEY),
        visualModel: process.env.VISION_MODEL_VERSION ?? "reference photo matcher v0.3",
        productionWeights: Boolean(process.env.VISION_INFERENCE_URL),
        notice: process.env.VISION_INFERENCE_URL
          ? "External fine-grained visual inference adapter is configured."
          : "No trained fine-grained weight bundle is configured; dataset entries describe the reproducible training manifest.",
      },
      datasets: AIRCRAFT_DATASETS,
      referenceImages: REFERENCE_PHOTOS.map(({ key, profile, image, credit, creditUrl }) => ({ key, profile, image, credit, creditUrl })),
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
