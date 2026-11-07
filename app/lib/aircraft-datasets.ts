export type DatasetStatus =
  | "active-reference"
  | "training-source"
  | "research-gated"
  | "license-gated"
  | "data-adapter";

export type AircraftDataset = {
  name: string;
  shortName: string;
  url: string;
  view: "Ground-to-air" | "Overhead" | "Mixed / recipe";
  role: string;
  coverage: string;
  status: DatasetStatus;
  licenseNote: string;
};

export const AIRCRAFT_DATASETS: AircraftDataset[] = [
  {
    name: "FGVC Aircraft via learn2learn",
    shortName: "FGVC",
    url: "https://github.com/learnables/learn2learn/blob/master/learn2learn/vision/datasets/fgvc_aircraft.py",
    view: "Ground-to-air",
    role: "Primary fine-grained type classifier",
    coverage: "10,200 photos · 102 aircraft variants",
    status: "training-source",
    licenseNote: "Use the upstream FGVC terms and attribution; images should be cropped to the labelled aircraft.",
  },
  {
    name: "May 2022 Aircraft Classification",
    shortName: "FGVC recipe",
    url: "https://github.com/kerrgarr/May-2022-Aircraft-Image-Classification",
    view: "Mixed / recipe",
    role: "ResNet/VGG training and evaluation recipe",
    coverage: "FGVC training recipe · 100 model variants",
    status: "active-reference",
    licenseNote: "Code recipe only; it points to FGVC rather than adding a separate image corpus.",
  },
  {
    name: "RarePlanes",
    shortName: "RarePlanes",
    url: "https://www.iqt.org/library/rareplanes-public-user-guide",
    view: "Overhead",
    role: "Overhead localisation and attribute pretraining only",
    coverage: "253 real scenes / ≈14,700 aircraft · 50,000 synthetic images / >600,000 annotations",
    status: "training-source",
    licenseNote: "AWS Open Data. Split by location to avoid leakage; remove tiled annotations with partialDec < 0.25. It is not a phone-view type classifier.",
  },
  {
    name: "FAIR1M",
    shortName: "FAIR1M",
    url: "https://huggingface.co/datasets/blanchon/FAIR1M",
    view: "Overhead",
    role: "Fine-grained overhead aircraft pretraining",
    coverage: "15,000 high-resolution images · 37 object classes",
    status: "research-gated",
    licenseNote: "The Hugging Face mirror lists the license as unknown; do not redistribute or train production weights until cleared.",
  },
  {
    name: "HRPlanesv2",
    shortName: "HRPlanesv2",
    url: "https://github.com/dilsadunsal/HRPlanesv2-Data-Set",
    view: "Overhead",
    role: "Single-class aircraft detector benchmark",
    coverage: "2,120 images · 14,335 labelled aircraft",
    status: "research-gated",
    licenseNote: "CC BY-NC-ND 4.0 / academic use only; excluded from production weight redistribution.",
  },
  {
    name: "BIT-AFGR50",
    shortName: "AFGR-50",
    url: "https://github.com/wgqqgw/BIT-KTYG-AFGR",
    view: "Overhead",
    role: "50-class overhead type benchmark",
    coverage: "12,500 aircraft instances · 50 classes",
    status: "research-gated",
    licenseNote: "Repository terms restrict the dataset to academic research and prohibit commercial use.",
  },
  {
    name: "Military Aircraft Recognition",
    shortName: "Military CNN",
    url: "https://github.com/S-Khos/Deep-Learning-for-Aircraft-Recognition",
    view: "Overhead",
    role: "Military-class research benchmark",
    coverage: "6,300 augmented crops · 9 military types",
    status: "research-gated",
    licenseNote: "MIT applies to code; source imagery and Google Maps terms require separate clearance.",
  },
  {
    name: "Planespotters.net",
    shortName: "Planespotters",
    url: "https://www.planespotters.net/",
    view: "Ground-to-air",
    role: "Registration, airframe and operator verification",
    coverage: "Civil airframe database and community photo reference",
    status: "license-gated",
    licenseNote: "Reference only. Images and database content are rights-controlled; do not scrape, bundle or train on them without explicit permission.",
  },
  {
    name: "JetPhotos",
    shortName: "JetPhotos",
    url: "https://www.jetphotos.com/",
    view: "Ground-to-air",
    role: "Registration-level photo verification",
    coverage: "6M+ screened aviation photos searchable by registration, airline and type",
    status: "license-gated",
    licenseNote: "Reference only. Photographers retain rights; obtain permission before using any photo for training or redistribution.",
  },
  {
    name: "API Ninjas Aircraft",
    shortName: "API Ninjas",
    url: "https://api-ninjas.com/api/aircraft",
    view: "Mixed / recipe",
    role: "Technical specifications after evidence-based type resolution",
    coverage: "1,000+ airplane models · dimensions, speed, range and ceiling",
    status: "data-adapter",
    licenseNote: "Lookup adapter, not an image classifier or registration database. Requires X-Api-Key; commercial use requires a premium plan.",
  },
  {
    name: "ADS-B Exchange",
    shortName: "ADS-B Exchange",
    url: "https://www.adsbexchange.com/data-products/sample-api-call/",
    view: "Mixed / recipe",
    role: "Primary live telemetry adapter for camera observations",
    coverage: "ICAO hex, registration/type, position, altitude, track, squawk and related live fields",
    status: "data-adapter",
    licenseNote: "Used only in live-camera mode with a server-side api-auth key. Static image uploads never query ADS-B; OpenSky is the live fallback.",
  },
];

export const ACTIVE_VISUAL_SOURCES = AIRCRAFT_DATASETS.filter(
  (dataset) => dataset.status === "training-source" || dataset.status === "active-reference",
).map((dataset) => dataset.shortName);
