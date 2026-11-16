export interface GeoAnchor {
  lat: number;
  lng: number;
  x: number;
  y: number;
}

// Calibrate once: stand at (or right-click on Google Maps) two known points and
// copy their latitude/longitude here. x/y are the same points on the campus map.
// Gate 2 is (218, 168) and Gate 1 is (220, 690) in lib/graph.ts.
//
// Example (replace with the real numbers):
//   { lat: 14.4001, lng: 120.9001, x: 218, y: 168 }, // Gate 2
//   { lat: 14.3955, lng: 120.9003, x: 220, y: 690 }, // Gate 1
export const GEO_ANCHORS: GeoAnchor[] = [];

const M_PER_DEG_LAT = 110540;
const M_PER_DEG_LNG = 111320;

export function geoReady(): boolean {
  return GEO_ANCHORS.length >= 2;
}

function toMeters(lat: number, lng: number, origin: GeoAnchor) {
  const e =
    (lng - origin.lng) * Math.cos((origin.lat * Math.PI) / 180) * M_PER_DEG_LNG;
  const n = (lat - origin.lat) * M_PER_DEG_LAT;
  return { re: e, im: -n };
}

// Two anchors fix position, scale and rotation, so the map does not have to be north-up.
export function toMapPoint(
  lat: number,
  lng: number,
): { x: number; y: number } | null {
  if (!geoReady()) return null;
  const [a, b] = GEO_ANCHORS;
  const g = toMeters(b.lat, b.lng, a);
  const m = { re: b.x - a.x, im: b.y - a.y };
  const norm = g.re * g.re + g.im * g.im;
  if (norm === 0) return null;
  const k = {
    re: (m.re * g.re + m.im * g.im) / norm,
    im: (m.im * g.re - m.re * g.im) / norm,
  };
  const z = toMeters(lat, lng, a);
  return {
    x: a.x + k.re * z.re - k.im * z.im,
    y: a.y + k.re * z.im + k.im * z.re,
  };
}
