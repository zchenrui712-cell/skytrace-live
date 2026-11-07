export type AircraftSpecs = {
  class: string;
  wake: string;
  engines: string;
  engineModel: string;
  lengthM: number | null;
  wingspanM: number | null;
  rangeNm: number | null;
  ceilingFt: number | null;
  maxSpeedKt: number | null;
  passengerCapacity: number | null;
};

type EvidenceAircraft = {
  aircraftType: string;
  manufacturer: string;
  model: string;
  tailNumber: string;
  tailNotice: string;
  age: string;
  country: string;
  confidence: number;
  evidence: string[];
  operator: {
    name: string;
    icao: string;
    iata: string;
    country: string;
    alliance: string;
    logo: string | null;
    logoSource: string;
  };
  specs: AircraftSpecs;
  apiQuery: { manufacturer: string; model: string };
};

export type PhotoProfileKey = "concorde" | "a320-sharklets" | "china-southern-787" | "korean-air-777";

export type ReferencePhoto = {
  key: string;
  profile: PhotoProfileKey;
  image: string;
  sha256: string;
  differenceHash: string;
  label: string;
  credit: string;
  creditUrl?: string;
  isReviewScreenshot?: boolean;
};

// This release includes the Wikimedia Commons photo with verified redistribution terms.
export const REFERENCE_PHOTOS: ReferencePhoto[] = [
  {
    key: "a320-sharklets",
    profile: "a320-sharklets",
    image: "/sample-aircraft/airbus-a320-sharklets.jpg",
    sha256: "c6b07877ceed0476bdb2b7d4f86437c327bf0a2db830277b77959aac846d0229",
    differenceHash: "00ce018e013c31e9ed0cfd6084f8c800",
    label: "Airbus A320-214, MSN 5098",
    credit: "Pedro Aragão · CC BY-SA 3.0 · photo uploaded to Wikimedia Commons (no modifications)",
    creditUrl: "https://commons.wikimedia.org/wiki/File:Airbus_A320-214,_Airbus_Industrie_JP7617615.jpg",
  },
];

export type PhotoProfile = EvidenceAircraft & {
  familySpecsNotice: string;
  verificationUrl: string;
};

export const PHOTO_PROFILES: Record<PhotoProfileKey, PhotoProfile> = {
  concorde: {
    aircraftType: "CONC",
    manufacturer: "Aérospatiale–BAC",
    model: "Concorde",
    tailNumber: "Not readable in this photo",
    tailNotice: "Air France operated more than one Concorde. This photo alone does not verify a registration.",
    age: "Historic aircraft; exact airframe age unavailable without registration",
    country: "France",
    confidence: 0,
    evidence: [],
    operator: {
      name: "Air France",
      icao: "AFR",
      iata: "AF",
      country: "France",
      alliance: "Not applicable to this historic photo",
      logo: null,
      logoSource: "AIR FRANCE titles visible on the supplied photo",
    },
    specs: {
      class: "Supersonic delta-wing airliner",
      wake: "Heavy",
      engines: "4 × turbojet",
      engineModel: "Rolls-Royce/Snecma Olympus 593",
      lengthM: 61.66,
      wingspanM: 25.56,
      rangeNm: 3900,
      ceilingFt: 60000,
      maxSpeedKt: 1177,
      passengerCapacity: 100,
    },
    apiQuery: { manufacturer: "Aerospatiale", model: "Concorde" },
    familySpecsNotice: "Historic type figures; speed and range depend on operating conditions.",
    verificationUrl: "https://airandspace.si.edu/collection-objects/concorde-fox-alpha-air-france/nasm_A20030139000",
  },
  "a320-sharklets": {
    aircraftType: "A320",
    manufacturer: "Airbus",
    model: "A320-214 with Sharklets",
    tailNumber: "F-WWIQ (temporary, at photo date)",
    tailNotice: "MSN 5098 used F-WWIQ for Airbus trials in 2012. It was later delivered as PK-AZE to Indonesia AirAsia; the historic photo depicts Airbus Industrie.",
    age: "MSN 5098 · first flown in 2012",
    country: "France (test registration)",
    confidence: 0,
    evidence: [],
    operator: {
      name: "Airbus Industrie (photo date)",
      icao: "AIB",
      iata: "—",
      country: "France",
      alliance: "Manufacturer flight-test",
      logo: null,
      logoSource: "AIRBUS titles and Wikimedia aircraft record",
    },
    specs: {
      class: "Narrow-body airliner",
      wake: "Medium",
      engines: "2 × jet",
      engineModel: "CFM56 family",
      lengthM: 37.57,
      wingspanM: 35.8,
      rangeNm: 3348,
      ceilingFt: null,
      maxSpeedKt: null,
      passengerCapacity: 180,
    },
    apiQuery: { manufacturer: "Airbus", model: "A320" },
    familySpecsNotice: "Airbus A320ceo with Sharklets specifications; range is 6,200 km converted to nautical miles.",
    verificationUrl: "https://commons.wikimedia.org/wiki/File:Airbus_A320-214,_Airbus_Industrie_JP7617615.jpg",
  },
  "china-southern-787": {
    aircraftType: "B789",
    manufacturer: "Boeing",
    model: "787-9 Dreamliner",
    tailNumber: "Not readable in this frame",
    tailNotice: "The 787th 787 special livery appears in B-1168 photo records. Registration is not legible in the submitted frame, so treat B-1168 as a reference for further verification.",
    age: "Unavailable without verified registration",
    country: "China",
    confidence: 0,
    evidence: [],
    operator: {
      name: "China Southern Airlines",
      icao: "CSN",
      iata: "CZ",
      country: "China",
      alliance: "Independent",
      logo: null,
      logoSource: "China Southern titles and tail emblem visible on the supplied screenshot",
    },
    specs: {
      class: "Wide-body airliner",
      wake: "Heavy",
      engines: "2 × jet",
      engineModel: "GEnx-1B / Rolls-Royce Trent 1000",
      lengthM: 62.8,
      wingspanM: 60.1,
      rangeNm: 8300,
      ceilingFt: null,
      maxSpeedKt: null,
      passengerCapacity: 325,
    },
    apiQuery: { manufacturer: "Boeing", model: "787-9" },
    familySpecsNotice: "Manufacturer 787-9 type figures; seats represent the upper end of Boeing’s two-class range.",
    verificationUrl: "https://www.jetphotos.com/photo/11936189",
  },
  "korean-air-777": {
    aircraftType: "B77x family",
    manufacturer: "Boeing",
    model: "777 (variant unverified)",
    tailNumber: "Not readable in this frame",
    tailNotice: "The provided image does not distinguish 777-200ER, 777-300 or 777-300ER or show a readable registration.",
    age: "Unavailable without verified registration",
    country: "South Korea",
    confidence: 0,
    evidence: [],
    operator: {
      name: "Korean Air",
      icao: "KAL",
      iata: "KE",
      country: "South Korea",
      alliance: "SkyTeam",
      logo: null,
      logoSource: "KOREAN AIR titles and tail emblem visible on the supplied screenshot",
    },
    specs: {
      class: "Wide-body airliner",
      wake: "Heavy",
      engines: "2 × jet",
      engineModel: "Variant dependent (PW4000 / Trent 800 / GE90)",
      lengthM: null,
      wingspanM: null,
      rangeNm: null,
      ceilingFt: null,
      maxSpeedKt: null,
      passengerCapacity: null,
    },
    apiQuery: { manufacturer: "Boeing", model: "777" },
    familySpecsNotice: "Boeing lists 777-200ER at 63.7 m × 60.9 m and 777-300ER at 73.9 m × 64.8 m; an exact value requires the variant.",
    verificationUrl: "https://www.boeing.com/commercial/777",
  },
};

function bitDifference(left: string, right: string) {
  let different = 0;
  for (let index = 0; index < 32; index += 1) {
    const xor = parseInt(left[index], 16) ^ parseInt(right[index], 16);
    different += (xor & 1) + ((xor >> 1) & 1) + ((xor >> 2) & 1) + ((xor >> 3) & 1);
  }
  return different;
}

export function matchPhotoReferences(sha256: string, proposedHashes: string[]) {
  const exact = REFERENCE_PHOTOS.find((reference) => reference.sha256 === sha256);
  if (exact) return { profile: exact.profile, reference: exact, similarity: 1, exact: true };

  const hashes = proposedHashes.filter((hash) => /^[0-9a-f]{32}$/.test(hash)).slice(0, 2);
  if (!hashes.length) return null;

  const scores = REFERENCE_PHOTOS.map((reference) => ({
    reference,
    similarity: Math.max(...hashes.map((hash) => 1 - bitDifference(hash, reference.differenceHash) / 128)),
  })).sort((a, b) => b.similarity - a.similarity);

  const best = scores[0];
  const runnerUp = scores.find((candidate) => candidate.reference.profile !== best.reference.profile);
  if (best.similarity < 0.92 || (runnerUp && best.similarity - runnerUp.similarity < 0.1)) return null;
  return { profile: best.reference.profile, reference: best.reference, similarity: best.similarity, exact: false };
}
