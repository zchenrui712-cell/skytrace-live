"use client";

import {
  Activity,
  Aperture,
  ArrowUpRight,
  Camera,
  Check,
  CircleAlert,
  Crosshair,
  Database,
  ImageUp,
  LocateFixed,
  MapPin,
  Navigation,
  Plane,
  Radio,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Signal,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AIRCRAFT_DATASETS } from "@/app/lib/aircraft-datasets";
import { PHOTO_PROFILES, REFERENCE_PHOTOS } from "@/app/lib/photo-references";

type LocationFix = { lat: number; lon: number; accuracy: number; altitudeM: number | null };

type Operation = {
  airport: string;
  name: string;
  city: string;
  operation: "Takeoff" | "Landing";
  time: string;
};

type Aircraft = {
  hex: string;
  callsign: string;
  registration: string;
  aircraftType: string;
  manufacturer: string;
  model: string;
  operator: string;
  operatorLogo?: string | null;
  operatorLogoSource?: string | null;
  year: string | null;
  country: string;
  lat: number;
  lon: number;
  altitudeFt: number | null;
  groundSpeedKt: number | null;
  heading: number | null;
  verticalRateFpm: number | null;
  squawk: string | null;
  emergency: string | null;
  seenSeconds: number;
  source: "ADS-B Exchange" | "OpenSky" | "Demo";
  origin?: string | null;
  destination?: string | null;
  distanceNm?: number;
  bearing?: number;
  operations?: Operation[];
};

type Match = Aircraft & {
  confidence: number;
  visualScore: number;
  expectedElevation: number | null;
  azimuthError: number | null;
  elevationError: number | null;
  inView: boolean | null;
};

type ImageMatch = {
  aircraftType: string;
  manufacturer: string;
  model: string;
  tailNumber: string;
  tailNotice: string;
  age: string;
  country: string;
  confidence: number;
  source: "Photo reference catalog";
  method: "Exact reference photo" | "Near-duplicate photo";
  evidence: string[];
  sourceNotice: string;
  modelNotice: string;
  specSource: string;
  dataSources: string[];
  recentFlightsNotice: string;
  familySpecsNotice: string;
  verificationUrl: string;
  operator: {
    name: string;
    icao: string;
    iata: string;
    country: string;
    alliance: string;
    logo: string | null;
    logoSource: string;
  };
  specs: {
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
  recentFlights: { flight: string; route: string; record: string }[];
};

const demoAircraft: Aircraft = {
  hex: "7C4926",
  callsign: "QFA7",
  registration: "VH-ZNJ",
  aircraftType: "B789",
  manufacturer: "Boeing",
  model: "787-9 Dreamliner",
  operator: "Qantas Airways",
  operatorLogo: null,
  operatorLogoSource: "Jxck-S airline-logos",
  year: "2018",
  country: "Australia",
  lat: -33.8427,
  lon: 151.1086,
  altitudeFt: 8425,
  groundSpeedKt: 291,
  heading: 286,
  verticalRateFpm: 1536,
  squawk: "1412",
  emergency: "none",
  seenSeconds: 0.8,
  source: "Demo",
  origin: "SYD · Sydney Kingsford Smith",
  destination: "SIN · Singapore Changi",
  distanceNm: 8.4,
  bearing: 283,
  operations: [
    {
      airport: "YSSY · SYD",
      name: "Sydney Kingsford Smith",
      city: "Sydney, Australia",
      operation: "Takeoff",
      time: "12 min ago",
    },
    {
      airport: "WSSS · SIN",
      name: "Singapore Changi",
      city: "Singapore",
      operation: "Landing",
      time: "2 days ago",
    },
    {
      airport: "EGLL · LHR",
      name: "London Heathrow",
      city: "London, United Kingdom",
      operation: "Landing",
      time: "3 days ago",
    },
  ],
};

const fmt = (value: number | null | undefined, suffix = "") =>
  value === null || value === undefined
    ? "Unavailable"
    : `${Math.round(value).toLocaleString()}${suffix}`;

function angularDifference(a: number, b: number) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

function distanceNm(a: LocationFix, b: Aircraft) {
  const radiusKm = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return (radiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))) / 1.852;
}

function bearingTo(a: LocationFix, b: Aircraft) {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180) / Math.PI + 360;
}

function scoreCandidates(
  aircraft: Aircraft[],
  location: LocationFix,
  heading: number | null,
  cameraElevation: number | null,
  visualScore: number,
) {
  return aircraft
    .map((item) => {
      const distance = distanceNm(location, item);
      const bearing = bearingTo(location, item) % 360;
      const expectedElevation = item.altitudeFt === null
        ? null
        : (Math.atan2(
            item.altitudeFt * 0.3048 - (location.altitudeM ?? 0),
            Math.max(150, distance * 1852),
          ) * 180) / Math.PI;
      const azimuthError = heading === null ? null : angularDifference(heading, bearing);
      const elevationError =
        cameraElevation === null || expectedElevation === null
          ? null
          : Math.abs(cameraElevation - expectedElevation);
      const azimuthFit = azimuthError === null ? 5 : Math.max(0, 32 - azimuthError * 0.9);
      const elevationFit = elevationError === null ? 4 : Math.max(0, 18 - elevationError * 0.75);
      const proximityFit = Math.max(0, 12 - distance * 0.26);
      const freshnessFit = Math.max(0, 11 - item.seenSeconds * 0.8);
      const inView =
        azimuthError === null
          ? null
          : azimuthError <= 42 && (elevationError === null || elevationError <= 32);
      const outsideViewPenalty = inView === false ? 28 : 0;
      const confidence = Math.max(
        8,
        Math.min(
          96,
          Math.round(
            18 +
              visualScore * 0.1 +
              azimuthFit +
              elevationFit +
              proximityFit +
              freshnessFit -
              outsideViewPenalty,
          ),
        ),
      );
      return {
        ...item,
        distanceNm: distance,
        bearing,
        confidence,
        visualScore,
        expectedElevation,
        azimuthError,
        elevationError,
        inView,
      };
    })
    .sort((a, b) => {
      if (a.inView !== b.inView) {
        if (a.inView === true) return -1;
        if (b.inView === true) return 1;
      }
      return b.confidence - a.confidence;
    });
}

function AircraftSilhouette() {
  return (
    <svg viewBox="0 0 180 180" aria-hidden="true" className="h-full w-full">
      <path
        d="M88 19c-5 1-7 7-7 12v39L31 95v12l50-10v35l-17 12v9l26-6 26 6v-9l-17-12V97l50 10V95L99 70V31c0-5-2-11-7-12h-4Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function Home() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [captureKind, setCaptureKind] = useState<"upload" | "camera" | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [location, setLocation] = useState<LocationFix | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [cameraElevation, setCameraElevation] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "locating" | "scanning" | "matched" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("Ready for a new observation");
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeMatch, setActiveMatch] = useState(0);
  const [visualScore, setVisualScore] = useState(78);
  const [imageMatch, setImageMatch] = useState<ImageMatch | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const selected = matches[activeMatch] ?? null;

  const sourceLabel = useMemo(() => {
    if (captureKind === "upload") return "Image-only · ADS-B disabled";
    if (!selected) return "Awaiting signal";
    return selected.source === "Demo" ? "Clearly labelled demo" : `Live via ${selected.source}`;
  }, [captureKind, selected]);

  function requestLocation(): Promise<LocationFix> {
    setStatus("locating");
    setMessage("Acquiring device location…");
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported on this device."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const fix = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitudeM: position.coords.altitude,
          };
          setLocation(fix);
          resolve(fix);
        },
        () => reject(new Error("Location permission is needed to cross-check nearby aircraft.")),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
      );
    });
  }

  async function enableOrientation() {
    try {
      const Orientation = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      if (typeof Orientation?.requestPermission === "function") {
        const permission = await Orientation.requestPermission();
        if (permission !== "granted") return;
      }
      window.addEventListener(
        "deviceorientation",
        (event) => {
          const iosHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number })
            .webkitCompassHeading;
          const nextHeading = iosHeading ?? (event.alpha === null ? null : (360 - event.alpha) % 360);
          if (nextHeading !== null) setHeading(Math.round(nextHeading));
          if (event.beta !== null) {
            const nextElevation = Math.max(-20, Math.min(90, 90 - Math.abs(event.beta)));
            setCameraElevation(Math.round(nextElevation));
          }
        },
        { passive: true },
      );
    } catch {
      setHeading(null);
      setCameraElevation(null);
    }
  }

  async function startCamera() {
    try {
      setMessage("Opening rear camera…");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      setCaptureKind("camera");
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      await Promise.allSettled([requestLocation(), enableOrientation()]);
      setStatus("idle");
      setMessage("Point at an aircraft and hold steady");
    } catch {
      setStatus("error");
      setMessage("Camera permission was not granted. You can upload a photo instead.");
    }
  }

  function estimateVisualSignal(canvas: HTMLCanvasElement) {
    const width = 112;
    const height = Math.max(54, Math.round((canvas.height / canvas.width) * width));
    const sample = document.createElement("canvas");
    sample.width = width;
    sample.height = height;
    const sampleCtx = sample.getContext("2d", { willReadFrequently: true });
    if (!sampleCtx) return 62;
    sampleCtx.drawImage(canvas, 0, 0, width, height);
    const data = sampleCtx.getImageData(0, 0, width, height).data;
    const luminance: number[] = [];
    let borderRed = 0;
    let borderGreen = 0;
    let borderBlue = 0;
    let borderCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      luminance.push(data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722);
      const pixel = i / 4;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      if (x < 5 || x >= width - 5 || y < 5 || y >= height - 5) {
        borderRed += data[i];
        borderGreen += data[i + 1];
        borderBlue += data[i + 2];
        borderCount += 1;
      }
    }
    borderRed /= Math.max(1, borderCount);
    borderGreen /= Math.max(1, borderCount);
    borderBlue /= Math.max(1, borderCount);
    const mean = luminance.reduce((sum, value) => sum + value, 0) / luminance.length;
    const variance =
      luminance.reduce((sum, value) => sum + (value - mean) ** 2, 0) / luminance.length;
    let evidencePixels = 0;
    let edgePixels = 0;
    let centeredEvidence = 0;
    let inspected = 0;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x;
        const rgbaIndex = index * 4;
        const gx = Math.abs(luminance[index + 1] - luminance[index - 1]);
        const gy = Math.abs(luminance[index + width] - luminance[index - width]);
        const edge = gx + gy;
        const colourDistance = Math.sqrt(
          (data[rgbaIndex] - borderRed) ** 2 +
            (data[rgbaIndex + 1] - borderGreen) ** 2 +
            (data[rgbaIndex + 2] - borderBlue) ** 2,
        );
        const centrality = Math.max(
          0,
          1 - Math.hypot((x / width - 0.5) * 1.6, (y / height - 0.5) * 1.6),
        );
        if (edge > 42) edgePixels += 1;
        if (colourDistance > 38 && edge > 18) {
          evidencePixels += 1;
          centeredEvidence += centrality;
        }
        inspected += 1;
      }
    }
    const evidenceRatio = evidencePixels / Math.max(1, inspected);
    const edgeRatio = edgePixels / Math.max(1, inspected);
    const sparseObjectFit =
      evidenceRatio < 0.001
        ? 0
        : evidenceRatio <= 0.12
          ? Math.min(22, evidenceRatio * 360)
          : Math.max(0, 22 - (evidenceRatio - 0.12) * 90);
    const centerFit = Math.min(15, (centeredEvidence / Math.max(1, evidencePixels)) * 18);
    const score =
      20 + Math.min(16, Math.sqrt(variance) * 0.35) + Math.min(22, edgeRatio * 180) + sparseObjectFit + centerFit;
    return Math.max(24, Math.min(94, Math.round(score)));
  }

  async function makePhotoHashes(file: File) {
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 17;
      canvas.height = 8;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Image decoding unavailable.");
      context.drawImage(bitmap, 0, 0, 17, 8);
      const pixels = context.getImageData(0, 0, 17, 8).data;
      let bits = "";
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 16; x += 1) {
          const left = (y * 17 + x) * 4;
          const right = left + 4;
          const light = (offset: number) => 0.299 * pixels[offset] + 0.587 * pixels[offset + 1] + 0.114 * pixels[offset + 2];
          bits += light(left) > light(right) ? "1" : "0";
        }
      }
      return [Array.from({ length: 32 }, (_, index) => parseInt(bits.slice(index * 4, index * 4 + 4), 2).toString(16)).join("")];
    } finally {
      bitmap.close();
    }
  }

  async function fetchNearby(fix: LocationFix, signal: number) {
    setStatus("scanning");
    setMessage("Cross-checking aircraft within 40 nautical miles…");
    try {
      const response = await fetch(
        `/api/aircraft?lat=${fix.lat.toFixed(6)}&lon=${fix.lon.toFixed(6)}&radius=40`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Live feed unavailable");
      const payload = (await response.json()) as { aircraft: Aircraft[]; notice?: string };
      if (!payload.aircraft.length) throw new Error("No transmitting aircraft found nearby");
      const scored = scoreCandidates(payload.aircraft, fix, heading, cameraElevation, signal);
      setMatches(scored.slice(0, 5));
      setActiveMatch(0);
      setStatus("matched");
      setMessage(payload.notice ?? `${payload.aircraft.length} live candidates cross-checked`);
    } catch (error) {
      setMatches([]);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Live cross-check failed");
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setUploadFile(file);
    setPreviewUrl(url);
    setCaptureKind("upload");
    setMatches([]);
    setImageMatch(null);
    setLocation(null);
    setHeading(null);
    setCameraElevation(null);
    setStatus("idle");
    setCameraOn(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setMessage("Photo loaded — image catalog only; location and ADS-B are disabled");

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d")?.drawImage(image, 0, 0);
      setVisualScore(estimateVisualSignal(canvas));
    };
    image.src = url;
  }

  async function analyseUpload() {
    try {
      if (!uploadFile) throw new Error("Upload an aircraft image first.");
      setStatus("scanning");
      setImageMatch(null);
      setMessage("Comparing this photo against validated reference images…");
      const hashes = await makePhotoHashes(uploadFile);
      const form = new FormData();
      form.append("image", uploadFile);
      form.append("hashes", JSON.stringify(hashes));
      const response = await fetch("/api/catalog", { method: "POST", body: form });
      const payload = (await response.json()) as ImageMatch | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload && payload.error ? payload.error : "No reliable aircraft match was found.");
      }
      setImageMatch(payload as ImageMatch);
      setMatches([]);
      setStatus("matched");
      setMessage((payload as ImageMatch).sourceNotice);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not analyse this image");
    }
  }

  async function captureFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const signal = estimateVisualSignal(canvas);
    setImageMatch(null);
    setVisualScore(signal);
    setPreviewUrl(canvas.toDataURL("image/jpeg", 0.86));
    setCameraOn(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    try {
      const fix = location ?? (await requestLocation());
      await fetchNearby(fix, signal);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not analyse this frame");
    }
  }

  function runDemo() {
    const signal = 88;
    setVisualScore(signal);
    setImageMatch(null);
    setUploadFile(null);
    setCaptureKind("camera");
    setPreviewUrl(null);
    setLocation({ lat: -33.8688, lon: 151.2093, accuracy: 8, altitudeM: 24 });
    setHeading(285);
    setCameraElevation(17);
    setMatches([{
      ...demoAircraft,
      confidence: 94,
      visualScore: signal,
      expectedElevation: 15,
      azimuthError: 2,
      elevationError: 2,
      inView: true,
    }]);
    setActiveMatch(0);
    setStatus("matched");
    setMessage("Demo scenario · Sydney CBD · sample data only");
  }

  function resetObservation() {
    setMatches([]);
    setActiveMatch(0);
    setPreviewUrl(null);
    setCameraOn(false);
    setCaptureKind(null);
    setImageMatch(null);
    setUploadFile(null);
    setLocation(null);
    setHeading(null);
    setCameraElevation(null);
    setStatus("idle");
    setMessage("Ready for a new observation");
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#07100d] text-[#ecf5ef]">
      <header className="border-b border-white/10 bg-[#08120f]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl border border-[#8bffb0]/30 bg-[#8bffb0]/10 text-[#8bffb0]">
              <Plane className="size-5 -rotate-12" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold tracking-tight">SkyTrace</span>
                <Badge className="border border-[#8bffb0]/20 bg-[#8bffb0]/10 text-[10px] text-[#8bffb0]">
                  LIVE LAB
                </Badge>
              </div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                Visual × ADS-B identification
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-2 text-xs text-white/50 sm:flex">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#8bffb0] opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-[#8bffb0]" />
              </span>
              Data adapters online
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={runDemo}
            >
              <Sparkles /> Try demo
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7">
        <section className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8bffb0]">
              <Crosshair className="size-3.5" /> Observation console
            </p>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Point. Cross-check. Identify.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/48">
              Use the live camera for location-aware ADS-B matching, or upload an existing image for a strictly non-live catalog identification.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/48">
            <StatusPill icon={<LocateFixed />} label={captureKind === "upload" ? "Location not used" : location ? `${location.accuracy.toFixed(0)} m GPS` : "GPS pending"} active={captureKind !== "upload" && !!location} />
            <StatusPill icon={<Navigation />} label={captureKind === "upload" ? "Pose not used" : heading === null ? "Camera pose pending" : `${heading}° az · ${cameraElevation ?? "—"}° el`} active={captureKind !== "upload" && heading !== null} />
            <StatusPill icon={<Radio />} label={captureKind === "upload" ? "ADS-B disabled" : selected?.source ?? "ADS-B ready"} active={captureKind !== "upload" && !!selected && selected.source !== "Demo"} />
          </div>
        </section>

        <div className="grid min-h-[590px] gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(430px,.92fr)]">
          <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#0b1713] shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Aperture className="size-4 text-[#8bffb0]" /> Capture target
              </div>
              <div className="flex items-center gap-2">
                <span className={`size-1.5 rounded-full ${status === "error" ? "bg-[#ff9a8b]" : "bg-[#8bffb0]"}`} />
                <span className="max-w-[210px] truncate text-[11px] text-white/40 sm:max-w-none">{message}</span>
              </div>
            </div>

            <Tabs defaultValue="camera" className="gap-0">
              <div className="px-4 pt-4 sm:px-5">
                <TabsList className="grid h-10 w-full grid-cols-2 rounded-xl bg-black/25 p-1">
                  <TabsTrigger value="camera" className="rounded-lg text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white">
                    <Camera /> Live camera
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="rounded-lg text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white">
                    <ImageUp /> Upload image
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="camera" className="p-4 sm:p-5">
                <CaptureStage
                  cameraOn={cameraOn}
                  videoRef={videoRef}
                  previewUrl={captureKind === "camera" ? previewUrl : null}
                  status={status}
                  onStartCamera={startCamera}
                  onCapture={captureFrame}
                  onReset={resetObservation}
                  visualScore={visualScore}
                />
              </TabsContent>

              <TabsContent value="upload" className="p-4 sm:p-5">
                <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={handleUpload} />
                {captureKind === "upload" && previewUrl ? (
                  <div className="space-y-3">
                    <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-black">
                      <img src={previewUrl} alt="Uploaded aircraft observation" className="h-full w-full object-contain" />
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/90 to-transparent p-4 pt-12">
                        <Button variant="outline" className="border-white/20 bg-black/30 text-white hover:bg-white/10" onClick={() => fileRef.current?.click()}>
                          <Upload /> Replace
                        </Button>
                        <Button className="bg-[#8bffb0] text-[#07100d] hover:bg-[#a8ffc1]" onClick={analyseUpload} disabled={status === "scanning" || status === "locating"}>
                          {status === "scanning" || status === "locating" ? <RefreshCw className="animate-spin" /> : <ScanLine />}
                          Match reference photo
                        </Button>
                      </div>
                    </div>
                    <p className="rounded-xl border border-white/10 bg-black/15 p-3 text-[10px] leading-5 text-white/45">
                      Comparing the upload with the included reference photo. Unfamiliar photos remain unclassified.
                    </p>
                  </div>
                ) : (
                  <button
                    className="group flex aspect-[16/10] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/20 transition hover:border-[#8bffb0]/40 hover:bg-[#8bffb0]/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8bffb0]"
                    onClick={() => fileRef.current?.click()}
                  >
                    <div className="grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/60 transition group-hover:text-[#8bffb0]">
                      <ImageUp className="size-6" />
                    </div>
                    <p className="mt-4 text-sm font-medium">Drop an aircraft photo or browse</p>
                    <p className="mt-1 text-xs text-white/35">JPG or PNG · up to 10 MB · upload analysis never uses location or ADS-B</p>
                  </button>
                )}
              </TabsContent>
            </Tabs>

            <div className="grid gap-px border-t border-white/10 bg-white/10 sm:grid-cols-3">
              <PipelineStep number="01" icon={<ScanLine />} title={captureKind === "upload" ? "Photo signature" : "Visual evidence"} detail={captureKind === "upload" ? "Exact or near-duplicate image" : `${visualScore}% centred-object signal`} active={!!captureKind} />
              <PipelineStep number="02" icon={captureKind === "upload" ? <Database /> : <Navigation />} title={captureKind === "upload" ? "Type specifications" : "3D view cone"} detail={captureKind === "upload" ? "Manufacturer technical record" : heading === null ? "GPS + camera pose" : `${heading}° az · ${cameraElevation ?? "—"}° el`} active={captureKind === "upload" ? !!previewUrl : !!location} />
              <PipelineStep number="03" icon={captureKind === "upload" ? <ShieldCheck /> : <Database />} title={captureKind === "upload" ? "Operator & photo" : "Live cross-check"} detail={captureKind === "upload" ? "Verified reference metadata" : "ADSBX → OpenSky"} active={status === "matched"} />
            </div>
          </section>

          <section className="flex min-h-[590px] flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#0b1713] shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Signal className="size-4 text-[#8bffb0]" /> Identification
              </div>
              <Badge variant="outline" className={`border-white/10 text-[10px] ${selected?.source === "Demo" ? "text-[#ffd38b]" : "text-white/45"}`}>
                {sourceLabel}
              </Badge>
            </div>

            {imageMatch && captureKind === "upload" ? (
              <ImageIdentification match={imageMatch} />
            ) : selected ? (
              <div className="flex flex-1 flex-col">
                <div className="grid gap-4 border-b border-white/10 p-4 sm:grid-cols-[170px_1fr] sm:p-5">
                  <div className="relative aspect-square overflow-hidden rounded-2xl border border-[#8bffb0]/20 bg-[#08130f]">
                    <div className="absolute inset-3 rounded-full border border-dashed border-[#8bffb0]/20" />
                    <div className="absolute inset-[27%] rounded-full bg-[#8bffb0]/10 blur-2xl" />
                    <div className="absolute inset-[23%] rotate-[34deg] text-[#b4ffca] drop-shadow-[0_0_14px_rgba(139,255,176,.45)]">
                      <AircraftSilhouette />
                    </div>
                    <div className="absolute left-3 top-3 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.18em] text-[#8bffb0]/70">
                      <span className="size-1 rounded-full bg-[#8bffb0]" /> target locked
                    </div>
                    <div className="absolute bottom-3 right-3 font-mono text-[10px] text-white/35">{selected.hex}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8bffb0]">Best match</p>
                        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{selected.manufacturer} {selected.model}</h2>
                        <div className="mt-2 flex items-center gap-2.5">
                          {selected.operatorLogo && (
                            <div className="flex h-8 w-20 items-center justify-center rounded-lg bg-white px-2 py-1">
                              <img src={selected.operatorLogo} alt={`${selected.operator} logo`} className="max-h-full max-w-full object-contain" />
                            </div>
                          )}
                          <p className="text-sm text-white/45">{selected.operator} · {selected.registration}</p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-3xl font-semibold tracking-[-0.05em] text-[#8bffb0]">{selected.confidence}%</span>
                        <p className="text-[9px] uppercase tracking-[0.18em] text-white/30">fused confidence</p>
                      </div>
                    </div>
                    <Progress value={selected.confidence} className="mt-4 h-1.5 bg-white/10 [&_[data-slot=progress-indicator]]:bg-[#8bffb0]" />
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <MiniMetric label="ICAO type" value={selected.aircraftType || "—"} />
                      <MiniMetric label="Built" value={selected.year ?? "Unknown"} />
                      <MiniMetric label="Registered" value={selected.country || "Unknown"} />
                      <MiniMetric label="View cone" value={selected.inView === null ? "Pose unavailable" : selected.inView ? "Inside frame" : "Outside frame"} />
                    </div>
                  </div>
                </div>

                <div className="grid flex-1 gap-px bg-white/10 sm:grid-cols-2">
                  <div className="bg-[#0b1713] p-4 sm:p-5">
                    <SectionLabel icon={<Activity />} title="Live telemetry" />
                    <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
                      <DataPoint label="Callsign" value={selected.callsign || "Unavailable"} mono />
                      <DataPoint label="Squawk" value={selected.squawk ?? "Unavailable"} mono accent />
                      <DataPoint label="Baro altitude" value={fmt(selected.altitudeFt, " ft")} />
                      <DataPoint label="Ground speed" value={fmt(selected.groundSpeedKt, " kt")} />
                      <DataPoint label="Track" value={fmt(selected.heading, "°")} />
                      <DataPoint label="Vertical rate" value={fmt(selected.verticalRateFpm, " fpm")} />
                      <DataPoint label="Distance" value={fmt(selected.distanceNm, " nm")} />
                      <DataPoint label="Last signal" value={`${selected.seenSeconds.toFixed(1)} s ago`} />
                      <DataPoint label="Expected elevation" value={fmt(selected.expectedElevation, "°")} />
                      <DataPoint label="Camera angular miss" value={selected.azimuthError === null ? "Pose unavailable" : `${selected.azimuthError.toFixed(1)}° az${selected.elevationError === null ? "" : ` · ${selected.elevationError.toFixed(1)}° el`}`} accent={selected.inView === true} />
                    </div>
                  </div>
                  <div className="bg-[#0b1713] p-4 sm:p-5">
                    <SectionLabel icon={<MapPin />} title="Route & airports" />
                    <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[9px] uppercase tracking-[0.15em] text-white/30">From</p>
                          <p className="truncate text-xs font-medium">{selected.origin ?? "Not in live feed"}</p>
                        </div>
                        <Plane className="size-4 shrink-0 rotate-45 text-[#8bffb0]" />
                        <div className="min-w-0 text-right">
                          <p className="text-[9px] uppercase tracking-[0.15em] text-white/30">Destination</p>
                          <p className="truncate text-xs font-medium">{selected.destination ?? "Not in live feed"}</p>
                        </div>
                      </div>
                      {!selected.destination && (
                        <p className="mt-2 border-t border-white/[0.07] pt-2 text-[9px] leading-4 text-white/28">
                          Destination is not broadcast in ADS-B; a flight-schedule provider is required to verify it.
                        </p>
                      )}
                    </div>
                    <div className="mt-3 space-y-2">
                      {(selected.operations?.length ? selected.operations.slice(0, 3) : []).map((operation) => (
                        <div key={`${operation.airport}-${operation.time}`} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
                          <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/5 text-white/45">
                            <Plane className={`size-3.5 ${operation.operation === "Landing" ? "rotate-[135deg]" : "rotate-45"}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-medium">{operation.airport} · {operation.operation}</p>
                            <p className="truncate text-[9px] text-white/30">{operation.name}, {operation.city}</p>
                          </div>
                          <span className="text-[9px] text-white/30">{operation.time}</span>
                        </div>
                      ))}
                      {!selected.operations?.length && (
                        <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-[10px] text-white/30">
                          Recent airport operations require ADS-B Exchange access.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {matches.length > 1 && (
                  <div className="border-t border-white/10 p-3 sm:px-5">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                      <span className="mr-1 shrink-0 text-[9px] uppercase tracking-[0.16em] text-white/30">Other candidates</span>
                      {matches.slice(1).map((match, index) => (
                        <button key={match.hex} onClick={() => setActiveMatch(index + 1)} className="shrink-0 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:border-[#8bffb0]/30">
                          <span className="text-[10px] font-medium">{match.callsign || match.registration}</span>
                          <span className="ml-2 text-[9px] text-[#8bffb0]">{match.confidence}%</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyResult status={status} message={message} onDemo={runDemo} mode={captureKind} />
            )}
          </section>
        </div>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <article className="overflow-hidden rounded-[20px] border border-white/10 bg-[#0b1713]">
            <div className="grid md:grid-cols-[240px_1fr]">
              <div className="relative min-h-40 overflow-hidden bg-black/30">
                <div className="absolute inset-0 grid place-items-center text-xs text-white/60" aria-hidden="true">Overhead imagery benchmark</div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0b1713]" />
                <Badge className="absolute bottom-3 left-3 border border-white/15 bg-black/55 text-[9px] text-white/70">RAREPLANES</Badge>
              </div>
              <div className="p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8bffb0]">Visual reference layer</p>
                <h3 className="mt-2 text-lg font-semibold">RarePlanes benchmark imagery</h3>
                <p className="mt-2 text-xs leading-5 text-white/42">
                  RarePlanes contains real and synthetic overhead imagery. Ground-to-air examples are needed to validate a model designed for phone-camera views.
                </p>
                <a href="https://github.com/matthewgiarra/aircraft-datasets" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-[#8bffb0] hover:underline">
                  Dataset source <ArrowUpRight className="size-3" />
                </a>
              </div>
            </div>
          </article>
          <article className="rounded-[20px] border border-white/10 bg-[#0b1713] p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#8bffb0]/10 text-[#8bffb0]"><ShieldCheck className="size-4" /></div>
              <div>
                <h3 className="text-sm font-semibold">Confidence, not certainty</h3>
                <p className="mt-1 text-xs leading-5 text-white/42">The score now rejects candidates outside the camera’s azimuth/elevation field, then combines centred foreground evidence, 3D view error, distance and transponder freshness. It is not an air-safety instrument.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px]">
              <a className="rounded-full border border-white/10 px-3 py-1.5 text-white/45 hover:text-white" href="https://www.adsbexchange.com/version-2-api/" target="_blank" rel="noreferrer">ADS-B Exchange fields</a>
              <a className="rounded-full border border-white/10 px-3 py-1.5 text-white/45 hover:text-white" href="https://openskynetwork.github.io/opensky-api/rest.html" target="_blank" rel="noreferrer">OpenSky fallback</a>
              <a className="rounded-full border border-white/10 px-3 py-1.5 text-white/45 hover:text-white" href="https://github.com/atoff/OpenAircraftType" target="_blank" rel="noreferrer">OpenAircraftType</a>
              <a className="rounded-full border border-white/10 px-3 py-1.5 text-white/45 hover:text-white" href="https://github.com/soaring-symbols/soaring-symbols" target="_blank" rel="noreferrer">Soaring Symbols</a>
              <a className="rounded-full border border-white/10 px-3 py-1.5 text-white/45 hover:text-white" href="https://github.com/Jxck-S/airline-logos" target="_blank" rel="noreferrer">Jxck-S logos</a>
            </div>
          </article>
        </section>

        <ReferenceGallery />
        <DatasetStack />
      </div>
    </main>
  );
}

function ReferenceGallery() {
  return (
    <section className="mt-4 overflow-hidden rounded-[20px] border border-white/10 bg-[#0b1713]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8bffb0]">Photo reference set</p>
          <h3 className="mt-1 text-lg font-semibold">Airbus A320 reference photo</h3>
          <p className="mt-1 text-xs leading-5 text-white/45">A small, labelled image catalog for exact and near-duplicate checks. It is not a trained classifier for other photos.</p>
        </div>
        <Badge variant="outline" className="border-[#8bffb0]/25 text-[#8bffb0]">1 indexed</Badge>
      </div>
      <div className="grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {REFERENCE_PHOTOS.map((reference) => {
          const profile = PHOTO_PROFILES[reference.profile];
          return (
            <article key={reference.key} className="bg-[#0b1713] p-3">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-[#08120f]">
                <img src={reference.image} alt={reference.label} loading="lazy" className="h-full w-full object-contain" />
                {reference.isReviewScreenshot && <span className="absolute right-2 top-2 rounded-full bg-[#07100d]/85 px-2 py-1 text-[8px] uppercase tracking-wide text-white/70">review screenshot</span>}
              </div>
              <h4 className="mt-3 text-sm font-semibold leading-5">{profile.manufacturer} {profile.model}</h4>
              <p className="mt-1 text-[11px] text-[#8bffb0]">{profile.operator.name}</p>
              <p className="mt-2 text-[10px] leading-4 text-white/45">{profile.specs.class} · {profile.specs.engines}</p>
              <p className="mt-1 text-[10px] leading-4 text-white/45">Length {profile.specs.lengthM ?? "variant dependent"} m · span {profile.specs.wingspanM ?? "variant dependent"} m</p>
              <p className="mt-2 text-[9px] leading-4 text-white/30">{profile.tailNumber}</p>
              {reference.creditUrl ? <a href={reference.creditUrl} target="_blank" rel="noreferrer" className="mt-2 block text-[9px] leading-4 text-white/45 underline decoration-white/20 hover:text-[#8bffb0]">{reference.credit}</a> : <p className="mt-2 text-[9px] leading-4 text-white/35">{reference.credit}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DatasetStack() {
  const statusLabel = {
    "active-reference": "Recipe linked",
    "training-source": "Training source",
    "research-gated": "License gated",
    "license-gated": "Reference only",
    "data-adapter": "Data adapter",
  } as const;

  return (
    <section className="mt-4 overflow-hidden rounded-[20px] border border-white/10 bg-[#0b1713]">
      <div className="flex flex-col justify-between gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8bffb0]">Source registry v0.3</p>
          <h3 className="mt-1 text-lg font-semibold">Training, lookup and verification sources — separated by licence and viewpoint</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-white/42">
            Ground-to-air datasets can train type recognition. RarePlanes and other overhead sources train localisation or attributes, not phone-view classification. Planespotters and JetPhotos are verification references only unless image owners grant training rights.
          </p>
        </div>
        <Badge variant="outline" className="w-fit border-[#8bffb0]/20 bg-[#8bffb0]/5 text-[9px] text-[#8bffb0]">
          VIEWPOINT-AWARE
        </Badge>
      </div>
      <div className="grid gap-px bg-white/10 md:grid-cols-2 xl:grid-cols-3">
        {AIRCRAFT_DATASETS.map((dataset) => (
          <a
            key={dataset.shortName}
            href={dataset.url}
            target="_blank"
            rel="noreferrer"
            className="group bg-[#0b1713] p-4 transition hover:bg-[#102019]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{dataset.shortName}</span>
                  <Badge
                    variant="outline"
                    className={`border-white/10 text-[8px] ${
                      dataset.status === "research-gated" || dataset.status === "license-gated" ? "text-[#ffd38b]/70" : "text-[#8bffb0]/80"
                    }`}
                  >
                    {statusLabel[dataset.status]}
                  </Badge>
                </div>
                <p className="mt-1 text-[9px] uppercase tracking-[0.13em] text-white/28">{dataset.view}</p>
              </div>
              <ArrowUpRight className="size-3.5 shrink-0 text-white/25 transition group-hover:text-[#8bffb0]" />
            </div>
            <p className="mt-3 text-[11px] font-medium text-white/72">{dataset.role}</p>
            <p className="mt-1 text-[10px] leading-4 text-white/35">{dataset.coverage}</p>
            <p className="mt-3 border-t border-white/[0.06] pt-3 text-[9px] leading-4 text-white/25">{dataset.licenseNote}</p>
          </a>
        ))}
        <div className="flex flex-col justify-center bg-[#0b1713] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">Runtime truth</p>
          <p className="mt-2 text-[11px] leading-5 text-white/42">
            Upload mode compares image fingerprints against the included reference and abstains on unfamiliar photos. The current build has no trained fine-grained visual weights; a general phone-view model still needs licensed data, held-out validation and an inference service.
          </p>
          <a href="/api/model" className="mt-3 inline-flex items-center gap-1 text-[10px] font-medium text-[#8bffb0] hover:underline">
            Inspect machine-readable manifest <ArrowUpRight className="size-3" />
          </a>
        </div>
      </div>
    </section>
  );
}

function ImageIdentification({ match }: { match: ImageMatch }) {
  const specValue = (value: number | null, suffix: string) =>
    value === null ? "Not listed" : `${value.toLocaleString()}${suffix}`;

  return (
    <div className="flex flex-1 flex-col">
      <div className="grid gap-4 border-b border-white/10 p-4 sm:grid-cols-[170px_1fr] sm:p-5">
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-[#8bffb0]/20 bg-[#08130f]">
          <div className="absolute inset-3 rounded-full border border-dashed border-[#8bffb0]/20" />
          <div className="absolute inset-[27%] rounded-full bg-[#8bffb0]/10 blur-2xl" />
          <div className="absolute inset-[23%] rotate-[28deg] text-[#b4ffca] drop-shadow-[0_0_14px_rgba(139,255,176,.45)]">
            <AircraftSilhouette />
          </div>
          <div className="absolute left-3 top-3 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.18em] text-[#8bffb0]/70">
            <span className="size-1 rounded-full bg-[#8bffb0]" /> reference match
          </div>
          <div className="absolute bottom-3 right-3 font-mono text-[10px] text-white/35">{match.aircraftType}</div>
        </div>
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8bffb0]">Non-live catalog result</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{match.manufacturer} {match.model}</h2>
              <p className="mt-1 text-sm text-white/45">Type {match.aircraftType} · registration {match.tailNumber}</p>
            </div>
            <div className="shrink-0 text-right">
              <span className="text-3xl font-semibold tracking-[-0.05em] text-[#8bffb0]">{match.confidence}%</span>
              <p className="text-[9px] uppercase tracking-[0.18em] text-white/30">photo similarity</p>
            </div>
          </div>
          <Progress value={match.confidence} className="mt-4 h-1.5 bg-white/10 [&_[data-slot=progress-indicator]]:bg-[#8bffb0]" />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniMetric label="Method" value={match.method} />
            <MiniMetric label="Wake class" value={match.specs.wake} />
            <MiniMetric label="Registered" value={match.country} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {match.evidence.map((item) => (
              <Badge key={item} variant="outline" className="border-[#8bffb0]/15 bg-[#8bffb0]/5 text-[8px] text-[#aaffc0]">{item}</Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="border-b border-[#8bffb0]/15 bg-[#8bffb0]/[0.045] px-4 py-3 sm:px-5">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#8bffb0]" />
          <div>
            <p className="text-[11px] font-medium text-[#caffd8]">Upload privacy condition enforced</p>
            <p className="mt-0.5 text-[9px] leading-4 text-white/38">No geolocation, device heading, ADS-B Exchange or OpenSky request was used. A tail number is shown only when independently documented for that photo.</p>
            <p className="mt-1 text-[9px] leading-4 text-[#ffd38b]/65">{match.modelNotice}</p>
          </div>
        </div>
      </div>

      <div className="grid flex-1 gap-px bg-white/10 sm:grid-cols-2">
        <div className="bg-[#0b1713] p-4 sm:p-5">
          <SectionLabel icon={<Plane />} title="Aircraft type details" />
          <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
            <DataPoint label="Manufacturer" value={match.manufacturer} />
            <DataPoint label="Model" value={match.model} />
            <DataPoint label="Airframe age" value={match.age} />
            <DataPoint label="Registration note" value={match.tailNotice} />
            <DataPoint label="Engines" value={match.specs.engines} />
            <DataPoint label="Engine model" value={match.specs.engineModel} />
            <DataPoint label="Length" value={specValue(match.specs.lengthM, " m")} />
            <DataPoint label="Wingspan" value={specValue(match.specs.wingspanM, " m")} />
            <DataPoint label="Range" value={specValue(match.specs.rangeNm, " nm")} />
            <DataPoint label="Ceiling" value={specValue(match.specs.ceilingFt, " ft")} />
            <DataPoint label="Max speed" value={specValue(match.specs.maxSpeedKt, " kt")} />
            <DataPoint label="Max passengers" value={specValue(match.specs.passengerCapacity, "")} />
          </div>
          <p className="mt-4 text-[9px] leading-4 text-white/35">Specifications: {match.specSource}. {match.familySpecsNotice}</p>
        </div>

        <div className="bg-[#0b1713] p-4 sm:p-5">
          <SectionLabel icon={<ShieldCheck />} title="Operator & reference flights" />
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white p-3 text-[#07100d]">
            <div className="flex h-10 w-24 shrink-0 items-center justify-center">
              {match.operator.logo ? (
                <img src={match.operator.logo} alt={`${match.operator.name} logo`} className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="rounded-lg bg-[#07100d] px-3 py-2 text-[10px] font-semibold text-white">{match.operator.icao}</span>
              )}
            </div>
            <div className="min-w-0 border-l border-black/10 pl-3">
              <p className="truncate text-xs font-semibold">{match.operator.name}</p>
              <p className="mt-0.5 text-[9px] text-black/50">{match.operator.iata} / {match.operator.icao} · {match.operator.alliance}</p>
            </div>
          </div>
          <p className="mt-2 text-[8px] text-white/25">Logo: {match.operator.logoSource} · trademarks belong to their owners</p>
          <div className="mt-3 space-y-2">
            {match.recentFlights.length ? match.recentFlights.map((flight) => (
              <div key={`${flight.flight}-${flight.route}`} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-black/10 px-3 py-2.5">
                <span className="font-mono text-[10px] font-semibold text-[#8bffb0]">{flight.flight}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] text-white/70">{flight.route}</p>
                  <p className="text-[8px] text-white/25">{flight.record}</p>
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-white/[0.06] bg-black/10 px-3 py-3 text-[9px] leading-4 text-white/35">
                No tail-specific flight history is reported from this non-live image.
              </div>
            )}
          </div>
          <p className="mt-3 text-[9px] leading-4 text-[#ffd38b]/65">{match.recentFlightsNotice}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={match.verificationUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[9px] text-[#8bffb0] hover:underline">Specific photo/type reference <ArrowUpRight className="size-3" /></a>
            <a href="https://www.planespotters.net/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[9px] text-[#8bffb0] hover:underline">Planespotters airframes <ArrowUpRight className="size-3" /></a>
            <a href="https://www.jetphotos.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[9px] text-[#8bffb0] hover:underline">JetPhotos registration search <ArrowUpRight className="size-3" /></a>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3 sm:px-5">
        <span className="text-[8px] uppercase tracking-[0.14em] text-white/25">Reference sources</span>
        {match.dataSources.map((source) => (
          <Badge key={source} variant="outline" className="border-white/10 text-[8px] text-white/40">{source}</Badge>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ icon, label, active }: { icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${active ? "border-[#8bffb0]/25 bg-[#8bffb0]/8 text-[#b7ffc9]" : "border-white/10 bg-white/[0.03]"}`}>
      <span className="[&_svg]:size-3">{icon}</span>{label}
    </span>
  );
}

function CaptureStage({ cameraOn, videoRef, previewUrl, status, onStartCamera, onCapture, onReset, visualScore }: {
  cameraOn: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  previewUrl: string | null;
  status: string;
  onStartCamera: () => void;
  onCapture: () => void;
  onReset: () => void;
  visualScore: number;
}) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-[#050a08]">
      <video ref={videoRef} playsInline muted className={`h-full w-full object-cover ${cameraOn ? "block" : "hidden"}`} />
      {previewUrl && !cameraOn && <img src={previewUrl} alt="Captured aircraft frame" className="h-full w-full object-contain" />}
      {!cameraOn && !previewUrl && (
        <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden">
          <div className="radar-grid absolute inset-0 opacity-60" />
          <div className="radar-sweep absolute size-[70%] max-h-[340px] max-w-[340px] rounded-full border border-[#8bffb0]/10" />
          <div className="relative grid size-20 place-items-center rounded-full border border-[#8bffb0]/20 bg-[#8bffb0]/5 text-[#8bffb0]">
            <Plane className="size-8 -rotate-12" />
            <span className="absolute -inset-3 animate-pulse rounded-full border border-[#8bffb0]/10" />
          </div>
          <p className="relative mt-5 text-sm font-medium">Camera and location stay permission-based</p>
          <p className="relative mt-1 max-w-xs text-center text-xs leading-5 text-white/35">Use the rear camera outdoors, then point toward a visible aircraft.</p>
          <Button className="relative mt-5 bg-[#8bffb0] text-[#07100d] hover:bg-[#a8ffc1]" onClick={onStartCamera}>
            <Camera /> Enable live camera
          </Button>
        </div>
      )}

      {(cameraOn || previewUrl) && (
        <>
          <div className="pointer-events-none absolute inset-0">
            <span className="absolute left-[18%] top-[18%] h-8 w-8 border-l border-t border-[#8bffb0]/70" />
            <span className="absolute right-[18%] top-[18%] h-8 w-8 border-r border-t border-[#8bffb0]/70" />
            <span className="absolute bottom-[18%] left-[18%] h-8 w-8 border-b border-l border-[#8bffb0]/70" />
            <span className="absolute bottom-[18%] right-[18%] h-8 w-8 border-b border-r border-[#8bffb0]/70" />
            <span className="absolute left-1/2 top-1/2 h-px w-6 -translate-x-1/2 bg-[#8bffb0]/50" />
            <span className="absolute left-1/2 top-1/2 h-6 w-px -translate-y-1/2 bg-[#8bffb0]/50" />
          </div>
          <div className="absolute left-3 top-3 flex gap-2">
            <Badge className="border border-white/10 bg-black/60 text-[9px] text-[#8bffb0]"><span className="size-1.5 animate-pulse rounded-full bg-[#8bffb0]" /> {cameraOn ? "LIVE" : "FRAME LOCKED"}</Badge>
            {!cameraOn && <Badge className="border border-white/10 bg-black/60 text-[9px] text-white/65">SIGNAL {visualScore}%</Badge>}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/90 to-transparent p-4 pt-14">
            <Button variant="outline" className="border-white/20 bg-black/30 text-white hover:bg-white/10" onClick={onReset}><X /> Reset</Button>
            {cameraOn && <Button className="h-12 rounded-full bg-white px-5 text-black hover:bg-white/90" onClick={onCapture} disabled={status === "scanning"}><span className="size-3 rounded-full bg-[#07100d]" /> Capture & identify</Button>}
          </div>
        </>
      )}
    </div>
  );
}

function PipelineStep({ number, icon, title, detail, active }: { number: string; icon: React.ReactNode; title: string; detail: string; active: boolean }) {
  return (
    <div className="flex items-center gap-3 bg-[#0b1713] px-4 py-3.5">
      <span className={`grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-3.5 ${active ? "bg-[#8bffb0]/10 text-[#8bffb0]" : "bg-white/5 text-white/30"}`}>{icon}</span>
      <div className="min-w-0"><p className="flex items-center gap-1.5 text-[11px] font-medium"><span className="font-mono text-[9px] text-white/25">{number}</span>{title}{active && <Check className="size-3 text-[#8bffb0]" />}</p><p className="truncate text-[9px] text-white/30">{detail}</p></div>
    </div>
  );
}

function EmptyResult({ status, message, onDemo, mode }: { status: string; message: string; onDemo: () => void; mode: "upload" | "camera" | null }) {
  const busy = status === "locating" || status === "scanning";
  const imageMode = mode === "upload";
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className={`relative grid size-24 place-items-center rounded-full border ${status === "error" ? "border-[#ff9a8b]/20 bg-[#ff9a8b]/5 text-[#ff9a8b]" : "border-[#8bffb0]/15 bg-[#8bffb0]/5 text-[#8bffb0]"}`}>
        {status === "error" ? <CircleAlert className="size-7" /> : busy ? <RefreshCw className="size-7 animate-spin" /> : <Crosshair className="size-7" />}
        {!busy && status !== "error" && <span className="absolute -inset-5 animate-pulse rounded-full border border-[#8bffb0]/10" />}
      </div>
      <h2 className="mt-7 text-xl font-semibold tracking-tight">{status === "error" ? "No verified match yet" : busy ? imageMode ? "Searching aircraft references" : "Scanning local airspace" : "Awaiting observation"}</h2>
      <p className="mt-2 max-w-sm text-xs leading-5 text-white/38">{message}</p>
      {!busy && <Button variant="outline" size="sm" className="mt-5 border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/10 hover:text-white" onClick={onDemo}><Sparkles /> Load a labelled demo</Button>}
      <div className="mt-10 grid w-full max-w-md grid-cols-3 gap-2">
        <TinyTrust icon={<Camera />} label="Image" />
        <TinyTrust icon={imageMode ? <Database /> : <Navigation />} label={imageMode ? "Type DB" : "Direction"} />
        <TinyTrust icon={imageMode ? <ShieldCheck /> : <Radio />} label={imageMode ? "No ADS-B" : "ADS-B"} />
      </div>
    </div>
  );
}

function TinyTrust({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <div className="rounded-xl border border-white/[0.07] bg-black/10 p-3 text-[9px] uppercase tracking-[0.14em] text-white/25"><span className="mx-auto mb-2 block w-fit [&_svg]:size-4">{icon}</span>{label}</div>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/[0.07] bg-black/10 p-2.5"><p className="text-[8px] uppercase tracking-[0.13em] text-white/25">{label}</p><p className="mt-1 truncate text-[11px] font-medium">{value}</p></div>;
}

function SectionLabel({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40"><span className="text-[#8bffb0] [&_svg]:size-3.5">{icon}</span>{title}</div>;
}

function DataPoint({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div><p className="text-[9px] uppercase tracking-[0.12em] text-white/25">{label}</p><p className={`mt-1 text-xs font-medium ${mono ? "font-mono" : ""} ${accent ? "text-[#8bffb0]" : "text-white/78"}`}>{value}</p></div>
  );
}
