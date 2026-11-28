export type ManagedDisplayNames = Record<string, string>;

export const buildingNameKey = (buildingId: string) => "building:" + buildingId;
export const floorNameKey = (buildingId: string, floor: number) =>
  "floor:" + buildingId + ":" + floor;
const buildingAliases: Record<string, string> = {
  "CTMO building": "ctmo",
  "HM building": "hm",
  Gymnasium: "gym",
};

export const syntheticRoomNameKey = (
  buildingId: string,
  floor: number,
  roomId: string,
) => "room:" + buildingId + ":" + floor + ":" + roomId;

export function displayName(
  names: ManagedDisplayNames,
  id: string | undefined,
  fallback: string,
): string {
  const aliasKey = id && buildingAliases[id] ? buildingNameKey(buildingAliases[id]) : undefined;
  const value = id && names[id]
    ? names[id]
    : aliasKey && names[aliasKey]
    ? names[aliasKey]
    : fallback;
  return value.replace(/\n/g, " ").trim();
}

export function buildingDisplayName(
  names: ManagedDisplayNames,
  buildingId: string,
  fallback: string,
): string {
  return displayName(names, buildingNameKey(buildingId), fallback);
}

export function floorDisplayName(
  names: ManagedDisplayNames,
  buildingId: string,
  floor: number,
  fallback: string,
): string {
  return displayName(names, floorNameKey(buildingId, floor), fallback);
}

export function fitMapLabel(
  value: string,
  width: number,
  height: number,
  // Largest font size in viewBox units. Floor plans use a 1365-wide viewBox;
  // the campus overview uses 8000 units, so it passes a larger cap.
  maxSize = 34,
  // Multiplier on the area-based starting size (campus labels use > 1).
  scale = 1,
): { lines: string[]; fontSize: number } {
  const text = value.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  const maxWidth = Math.max(1, width * 0.86);
  const maxHeight = Math.max(1, height * 0.68);
  const startSize = Math.max(
    8,
    Math.min(maxSize, Math.sqrt(Math.max(1, width * height)) * 0.085 * scale),
  );

  let broke = false;
  const wrap = (fontSize: number): string[] => {
    const maxChars = Math.max(1, Math.floor(maxWidth / (fontSize * 0.58)));
    const result: string[] = [];
    let line = "";
    broke = false;
    for (const word of text.split(" ")) {
      if (word.length > maxChars) {
        broke = true;
        if (line) {
          result.push(line);
          line = "";
        }
        for (let offset = 0; offset < word.length; offset += maxChars) {
          result.push(word.slice(offset, offset + maxChars));
        }
        continue;
      }
      const candidate = line ? line + " " + word : word;
      if (candidate.length > maxChars && line) {
        result.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) result.push(line);
    return result.length ? result : [""];
  };

  for (let fontSize = Math.floor(startSize); fontSize >= 8; fontSize -= 1) {
    const lines = wrap(fontSize);
    // Prefer a smaller font over splitting a word ("Registra / r").
    if (
      !broke &&
      lines.length * fontSize * 1.18 <= maxHeight &&
      lines.every((line) => line.length * fontSize * 0.58 <= maxWidth)
    ) {
      return { lines, fontSize };
    }
  }

  // Clip at the room boundary rather than allowing text into neighbouring areas.
  for (let fontSize = Math.floor(startSize); fontSize >= 8; fontSize -= 1) {
    const lines = wrap(fontSize);
    if (lines.length * fontSize * 1.18 <= maxHeight) return { lines, fontSize };
  }
  return { lines: wrap(8), fontSize: 8 };
}
