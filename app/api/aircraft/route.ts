import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type AircraftDetail = { manufacturer: string; model: string };
type AirportDetail = { name: string; city: string };

const TYPE_DETAILS: Record<string, AircraftDetail> = {
  A20N: { manufacturer: "Airbus", model: "A320neo" },
  A21N: { manufacturer: "Airbus", model: "A321neo" },
  A320: { manufacturer: "Airbus", model: "A320" },
  A321: { manufacturer: "Airbus", model: "A321" },
  A332: { manufacturer: "Airbus", model: "A330-200" },
  A333: { manufacturer: "Airbus", model: "A330-300" },
  A359: { manufacturer: "Airbus", model: "A350-900" },
  A35K: { manufacturer: "Airbus", model: "A350-1000" },
  A388: { manufacturer: "Airbus", model: "A380-800" },
  B38M: { manufacturer: "Boeing", model: "737 MAX 8" },
  B738: { manufacturer: "Boeing", model: "737-800" },
  B744: { manufacturer: "Boeing", model: "747-400" },
  B788: { manufacturer: "Boeing", model: "787-8 Dreamliner" },
  B789: { manufacturer: "Boeing", model: "787-9 Dreamliner" },
  B78X: { manufacturer: "Boeing", model: "787-10 Dreamliner" },
  B77W: { manufacturer: "Boeing", model: "777-300ER" },
  DH8D: { manufacturer: "De Havilland Canada", model: "Dash 8-400" },
  E190: { manufacturer: "Embraer", model: "E190" },
};

const CALLSIGN_OPERATORS: Record<string, string> = {
  QFA: "Qantas Airways",
  JST: "Jetstar Airways",
  VOZ: "Virgin Australia",
  RXA: "Regional Express",
  SIA: "Singapore Airlines",
  UAE: "Emirates",
  ETD: "Etihad Airways",
  QTR: "Qatar Airways",
  ANZ: "Air New Zealand",
  CPA: "Cathay Pacific",
  BAW: "British Airways",
  UAL: "United Airlines",
  AAL: "American Airlines",
  DAL: "Delta Air Lines",
  AFR: "Air France",
  DLH: "Lufthansa",
  KLM: "KLM Royal Dutch Airlines",
};

const OPERATOR_LOGOS: Record<string, { path: string; source: string }> = {};

const AIRPORTS: Record<string, AirportDetail> = {
  YSSY: { name: "Sydney Kingsford Smith", city: "Sydney, Australia" },
  YMML: { name: "Melbourne Airport", city: "Melbourne, Australia" },
  YBBN: { name: "Brisbane Airport", city: "Brisbane, Australia" },
  YPAD: { name: "Adelaide Airport", city: "Adelaide, Australia" },
  YPPH: { name: "Perth Airport", city: "Perth, Australia" },
  WSSS: { name: "Singapore Changi", city: "Singapore" },
  VHHH: { name: "Hong Kong International", city: "Hong Kong" },
  NZAA: { name: "Auckland Airport", city: "Auckland, New Zealand" },
  EGLL: { name: "London Heathrow", city: "London, United Kingdom" },
  OMDB: { name: "Dubai International", city: "Dubai, United Arab Emirates" },
  KJFK: { name: "John F. Kennedy International", city: "New York, United States" },
  KLAX: { name: "Los Angeles International", city: "Los Angeles, United States" },
};

function operatorFor(callsign: string, fallback?: unknown) {
  if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
  return CALLSIGN_OPERATORS[callsign.slice(0, 3).toUpperCase()] ?? "Operator not identified";
}

function operatorLogoFor(callsign: string) {
  return OPERATOR_LOGOS[callsign.slice(0, 3).toUpperCase()] ?? null;
}

function countryForRegistration(registration: string) {
  const reg = registration.toUpperCase();
  if (reg.startsWith("VH-")) return "Australia";
  if (reg.startsWith("ZK-")) return "New Zealand";
  if (reg.startsWith("9V-")) return "Singapore";
  if (reg.startsWith("B-")) return "China / Hong Kong";
  if (reg.startsWith("G-")) return "United Kingdom";
  if (reg.startsWith("N")) return "United States";
  if (reg.startsWith("A6-")) return "United Arab Emirates";
  if (reg.startsWith("A7-")) return "Qatar";
  return "Registration country unavailable";
}

function aircraftDetails(type: string, description?: unknown) {
  const known = TYPE_DETAILS[type.toUpperCase()];
  if (known) return known;
  if (typeof description === "string" && description.trim()) {
    const trimmed = description.trim();
    const manufacturer = trimmed.split(" ")[0] || "Aircraft";
    return { manufacturer, model: trimmed.slice(manufacturer.length).trim() || type || "Unknown model" };
  }
  return { manufacturer: "Aircraft", model: type || "Model unavailable" };
}

function relativeTime(epochSeconds: number) {
  const delta = Math.max(0, Math.floor(Date.now() / 1000 - epochSeconds));
  if (delta < 90) return `${delta} sec ago`;
  if (delta < 3600) return `${Math.round(delta / 60)} min ago`;
  if (delta < 86400) return `${Math.round(delta / 3600)} hr ago`;
  return `${Math.round(delta / 86400)} days ago`;
}

async function fetchOperations(hex: string, apiKey: string) {
  try {
    const from = Math.floor(Date.now() / 1000) - 7 * 86400;
    const response = await fetch(
      `https://gateway.adsbexchange.com/api/aircraft/v2/operations/icao/${encodeURIComponent(hex)}?time_from=${from}`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "api-auth": apiKey,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) return { operations: [], meta: {} as Record<string, unknown> };
    const payload = (await response.json()) as { items?: Record<string, unknown>[] };
    const items = payload.items ?? [];
    const operations = items.slice(0, 8).map((item) => {
      const airport = String(item.airport ?? "Unknown airport").toUpperCase();
      const detail = AIRPORTS[airport] ?? { name: airport, city: "Airport details unavailable" };
      const iata = typeof item.iata_code === "string" ? item.iata_code.trim().toUpperCase() : "";
      const municipality = typeof item.municipality === "string" ? item.municipality.trim() : "";
      const airportCountry = typeof item.iso_country === "string" ? item.iso_country.trim() : "";
      return {
        airport: iata ? `${airport} · ${iata}` : airport,
        name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : detail.name,
        city: municipality ? `${municipality}${airportCountry ? `, ${airportCountry}` : ""}` : detail.city,
        operation: String(item.operation ?? "").toLowerCase().includes("land") ? "Landing" : "Takeoff",
        time: relativeTime(Number(item.time_epoch ?? 0)),
      };
    });
    return { operations, meta: items[0] ?? {} };
  } catch {
    return { operations: [], meta: {} as Record<string, unknown> };
  }
}

async function fromAdsbExchange(lat: number, lon: number, radius: number, apiKey: string) {
  const response = await fetch(
    `https://gateway.adsbexchange.com/api/aircraft/v2/lat/${lat}/lon/${lon}/dist/${radius}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "api-auth": apiKey,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) throw new Error(`ADS-B Exchange returned ${response.status}`);
  const payload = (await response.json()) as { ac?: Record<string, unknown>[] };
  const rawAircraft = (payload.ac ?? []).filter(
    (item) => typeof item.lat === "number" && typeof item.lon === "number",
  );

  const enriched = await Promise.all(
    rawAircraft.slice(0, 12).map(async (raw, index) => {
      const operationData = index < 3
        ? await fetchOperations(String(raw.hex ?? ""), apiKey)
        : { operations: [], meta: {} as Record<string, unknown> };
      const type = String(raw.t ?? operationData.meta.icaotype ?? "").trim().toUpperCase();
      const callsign = String(raw.flight ?? "").trim();
      const operatorLogo = operatorLogoFor(callsign);
      const registration = String(raw.r ?? operationData.meta.reg ?? operationData.meta.registration ?? "").trim();
      const details = aircraftDetails(
        type,
        raw.desc ??
          [operationData.meta.manufacturer, operationData.meta.model].filter(Boolean).join(" "),
      );
      const operations = operationData.operations;
      const latestTakeoff = operations.find((item) => item.operation === "Takeoff");
      return {
        hex: String(raw.hex ?? "").toUpperCase(),
        callsign,
        registration: registration || "Registration unavailable",
        aircraftType: type,
        manufacturer: details.manufacturer,
        model: details.model,
        operator: operatorFor(callsign, raw.ownOp ?? operationData.meta.ownop),
        operatorLogo: operatorLogo?.path ?? null,
        operatorLogoSource: operatorLogo?.source ?? null,
        year:
          typeof raw.year === "string"
            ? raw.year
            : typeof operationData.meta.year === "string"
              ? operationData.meta.year
              : null,
        country: countryForRegistration(registration),
        lat: Number(raw.lat),
        lon: Number(raw.lon),
        altitudeFt: typeof raw.alt_baro === "number" ? raw.alt_baro : null,
        groundSpeedKt: typeof raw.gs === "number" ? raw.gs : null,
        heading: typeof raw.track === "number" ? raw.track : null,
        verticalRateFpm: typeof raw.baro_rate === "number" ? raw.baro_rate : null,
        squawk: typeof raw.squawk === "string" ? raw.squawk : null,
        emergency: typeof raw.emergency === "string" ? raw.emergency : null,
        seenSeconds: typeof raw.seen === "number" ? raw.seen : 0,
        source: "ADS-B Exchange" as const,
        origin: latestTakeoff ? `${latestTakeoff.airport} · ${latestTakeoff.name}` : null,
        destination: null,
        operations,
      };
    }),
  );
  return enriched;
}

async function fromOpenSky(lat: number, lon: number, radius: number) {
  const latDelta = radius / 60;
  const lonDelta = radius / Math.max(8, 60 * Math.cos((lat * Math.PI) / 180));
  const url = new URL("https://opensky-network.org/api/states/all");
  url.searchParams.set("lamin", String(lat - latDelta));
  url.searchParams.set("lamax", String(lat + latDelta));
  url.searchParams.set("lomin", String(lon - lonDelta));
  url.searchParams.set("lomax", String(lon + lonDelta));
  url.searchParams.set("extended", "1");
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "SkyTrace-Live/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`OpenSky returned ${response.status}`);
  const payload = (await response.json()) as { time?: number; states?: unknown[][] | null };
  return (payload.states ?? [])
    .filter((state) => typeof state[5] === "number" && typeof state[6] === "number")
    .slice(0, 60)
    .map((state) => {
      const callsign = String(state[1] ?? "").trim();
      const operatorLogo = operatorLogoFor(callsign);
      return {
        hex: String(state[0] ?? "").toUpperCase(),
        callsign,
        registration: "Unavailable in OpenSky state vector",
        aircraftType: "",
        manufacturer: "Aircraft",
        model: "Type unavailable in fallback feed",
        operator: operatorFor(callsign),
        operatorLogo: operatorLogo?.path ?? null,
        operatorLogoSource: operatorLogo?.source ?? null,
        year: null,
        country: String(state[2] ?? "Country unavailable"),
        lat: Number(state[6]),
        lon: Number(state[5]),
        altitudeFt: typeof state[7] === "number" ? Number(state[7]) * 3.28084 : null,
        groundSpeedKt: typeof state[9] === "number" ? Number(state[9]) * 1.94384 : null,
        heading: typeof state[10] === "number" ? Number(state[10]) : null,
        verticalRateFpm: typeof state[11] === "number" ? Number(state[11]) * 196.85 : null,
        squawk: typeof state[14] === "string" ? state[14] : null,
        emergency: null,
        seenSeconds:
          typeof state[4] === "number" ? Math.max(0, (payload.time ?? Date.now() / 1000) - Number(state[4])) : 0,
        source: "OpenSky" as const,
        origin: null,
        destination: null,
        operations: [],
      };
    });
}

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  const requestedRadius = Number(request.nextUrl.searchParams.get("radius") ?? 40);
  const radius = Math.min(80, Math.max(2, requestedRadius));

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "Valid latitude and longitude are required." }, { status: 400 });
  }

  const apiKey = process.env.ADSBX_API_KEY;
  if (apiKey) {
    try {
      const aircraft = await fromAdsbExchange(lat, lon, radius, apiKey);
      return NextResponse.json(
        { aircraft, source: "ADS-B Exchange", notice: `${aircraft.length} live candidates via ADS-B Exchange` },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    } catch {
      // Fall through to the public OpenSky state-vector endpoint.
    }
  }

  try {
    const aircraft = await fromOpenSky(lat, lon, radius);
    return NextResponse.json(
      {
        aircraft,
        source: "OpenSky",
        notice: apiKey
          ? `${aircraft.length} candidates · ADS-B Exchange unavailable, using OpenSky`
          : `${aircraft.length} candidates · OpenSky fallback (add ADSBX_API_KEY for full details)`,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Both live aircraft feeds are currently unavailable.", aircraft: [] },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
