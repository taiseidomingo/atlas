import { listEnvTeacherNames } from "./auth";
import {
  campusNow,
  DAY_NAMES,
  formatTime,
  getDepartmentArea,
  listSchedules,
  professorKey,
  STATUS_LABEL,
  type ScheduleEntry,
} from "./faculty";
import { campusGraph } from "./graph";
import { buildingById, buildingOfNode } from "./mapData";
import { listReservations } from "./reservation";
import { getBuildingName, getFloorName, getRoomName } from "./roomAdmin";
import { listTeacherAccounts } from "./teacherAccounts";

/**
 * Deterministic professor lookup for the chatbot. Answers are built from
 * records only (room claims, admin schedules, department areas) — never by
 * the language model — and every location is labelled with its source:
 *   1. active room claim     -> confirmed location
 *   2. faculty schedule      -> scheduled location (not confirmed)
 *   3. department area       -> suggested location (not confirmed)
 */
export interface ChatAction {
  label: string;
  destinationId: string;
}

export interface ProfessorAnswer {
  reply: string;
  actions: ChatAction[];
  source: "claim" | "schedule" | "department" | "none";
}

interface Professor {
  key: string;
  name: string;
  department: string | null;
  usernames: string[];
}

function directory(): Professor[] {
  const byKey = new Map<string, Professor>();
  const add = (name: string, department: string | null, username?: string) => {
    const key = professorKey(name);
    if (!key) return;
    const existing = byKey.get(key);
    if (existing) {
      existing.department ??= department;
      if (username) existing.usernames.push(username);
      return;
    }
    byKey.set(key, { key, name, department, usernames: username ? [username] : [] });
  };
  listTeacherAccounts().forEach((a) => add(a.displayName, a.department || null, a.username));
  listEnvTeacherNames().forEach((n) => add(n, null));
  listSchedules().forEach((s) => add(s.professorName, s.department));
  listReservations().forEach((r) => add(r.professor, null));
  return [...byKey.values()];
}

const INTENT =
  /\b(where|find|locate|located|look(?:ing)? for|see|meet|visit|room|office|available|availability|schedule|class|consult|is .* in|prof|professor|dr|sir|ma'?am|teacher|instructor|faculty)\b/i;
const TITLE_NAME =
  /\b(?:prof(?:essor)?|dr|sir|ma'?am|mr|mrs|ms|engr|teacher|instructor)\.?\s+([a-z][\w.'-]*(?:\s+[a-z][\w.'-]*){0,2})/i;

function words(value: string): string[] {
  return value.split(" ").filter(Boolean);
}

/** Professors named in the message: full-name matches first, then surname/first-name matches. */
export function matchProfessors(message: string): Professor[] {
  const text = ` ${professorKey(message)} `;
  const people = directory();
  const full = people.filter(
    (p) => text.includes(` ${p.key} `) || p.usernames.some((u) => text.includes(` ${professorKey(u)} `)),
  );
  if (full.length > 0) return full;
  if (!INTENT.test(message)) return [];
  const tokens = new Set(words(text));
  return people.filter((p) => {
    const parts = words(p.key).filter((w) => w.length >= 3);
    if (parts.length === 0) return false;
    // Surname, or a single-word name (e.g. "Prof. Ricky").
    return tokens.has(parts[parts.length - 1]) || (parts.length === 1 && tokens.has(parts[0]));
  });
}

function placeOf(nodeId: string): string {
  const node = campusGraph.nodes.find((n) => n.id === nodeId);
  if (!node) return "";
  const b = buildingOfNode(nodeId);
  if (!b) return "campus grounds";
  const building = getBuildingName(b, buildingById[b].name);
  return node.floor ? `${building}, ${getFloorName(b, node.floor)}` : building;
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: process.env.CAMPUS_TIMEZONE || "Asia/Manila",
  });
}

function block(s: ScheduleEntry): string {
  return `${s.location} from ${formatTime(s.start)} to ${formatTime(s.end)}`;
}

function routeAction(nodeId: string | null | undefined, label: string): ChatAction[] {
  return nodeId && campusGraph.nodes.some((n) => n.id === nodeId)
    ? [{ label, destinationId: nodeId }]
    : [];
}

export function locateProfessor(p: Professor, now = campusNow()): ProfessorAnswer {
  // 1. Active room claim: the only confirmed location.
  const claim = listReservations().find((r) => professorKey(r.professor) === p.key);
  if (claim) {
    const room = getRoomName(claim.nodeId, claim.roomName);
    const where = placeOf(claim.nodeId);
    return {
      source: "claim",
      reply:
        `✅ Confirmed (active room claim): ${claim.professor} is in ${room}` +
        `${where ? ` (${where})` : ""}, claimed at ${timeOf(claim.claimedAt)}.`,
      actions: routeAction(claim.nodeId, `Route to ${room}`),
    };
  }

  const lines = [`${p.name} has no active room claim at the moment.`];
  const actions: ChatAction[] = [];
  const schedules = listSchedules().filter((s) => professorKey(s.professorName) === p.key);
  const department = p.department ?? schedules[0]?.department ?? null;

  // 2. Faculty schedule for right now.
  const current = schedules.find((s) => s.day === now.day && s.start <= now.time && now.time < s.end);
  if (current) {
    if (current.status === "unavailable") {
      lines.push(
        `📅 According to the faculty schedule, ${p.name} is marked "${STATUS_LABEL.unavailable}" from ` +
          `${formatTime(current.start)} to ${formatTime(current.end)} today${current.note ? ` (${current.note})` : ""}.`,
      );
    } else {
      lines.push(
        `📅 According to the faculty schedule (${STATUS_LABEL[current.status].toLowerCase()}), ${p.name} is scheduled at ` +
          `${block(current)} today${current.note ? ` — ${current.note}` : ""}. ` +
          `This is the scheduled location, not a confirmed one — you may check there.`,
      );
      actions.push(...routeAction(current.nodeId, `Route to ${current.location}`));
      return { source: "schedule", reply: lines.join("\n\n"), actions };
    }
  } else if (schedules.length > 0) {
    const later = schedules
      .filter((s) => s.day === now.day && s.start > now.time && s.status !== "unavailable")
      .sort((a, b) => a.start.localeCompare(b.start))[0];
    lines.push(
      later
        ? `📅 Faculty schedule: nothing right now; next today is ${block(later)}.`
        : `📅 Faculty schedule: no scheduled block for the rest of ${DAY_NAMES[now.day]}.`,
    );
  }

  // 3. Department faculty area as a suggestion.
  if (department) {
    const area = getDepartmentArea(department);
    if (area) {
      lines.push(
        `💡 Suggested (not confirmed): ${p.name} is affiliated with the ${department}. ` +
          `You may check the department's faculty area: ${area.location}.`,
      );
      actions.push(...routeAction(area.nodeId, "Route to faculty area"));
    } else {
      lines.push(
        `💡 ${p.name} is affiliated with the ${department}, but no faculty area has been set for that department yet.`,
      );
    }
  } else if (schedules.length === 0) {
    lines.push(`I don't have a department or schedule on file for ${p.name}, so I can't suggest a location.`);
  }

  return { source: department ? "department" : current ? "schedule" : "none", reply: lines.join("\n\n"), actions };
}

/** Professor questions answered from records; null when the message isn't about a professor. */
export function answerProfessorQuestion(message: string): ProfessorAnswer | null {
  const matches = matchProfessors(message);
  if (matches.length === 1) return locateProfessor(matches[0]);
  if (matches.length > 1) {
    return {
      source: "none",
      reply: `I found more than one professor matching that: ${matches
        .slice(0, 6)
        .map((p) => p.name)
        .join(", ")}. Which one do you mean? Please include their full name.`,
      actions: [],
    };
  }
  const asked = message.match(TITLE_NAME);
  if (asked && /\b(where|find|locate|look|see|meet|room|office|available|schedule)\b/i.test(message)) {
    return {
      source: "none",
      reply: `I couldn't find a professor named "${asked[1].trim()}" in the faculty records, so I can't tell you where they are. Please check the spelling or ask at the department office.`,
      actions: [],
    };
  }
  return null;
}
