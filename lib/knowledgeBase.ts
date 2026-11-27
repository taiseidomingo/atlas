import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { extractText, type SupportedExtension } from "./documentText";
import { kv } from "./kv";
import { markDirty, useKv } from "./storeMode";

/**
 * Admin-managed knowledge base for the chatbot.
 *
 * File mode (local / server with a disk; git-ignored runtime data):
 *   data/knowledge/index.json        document metadata
 *   data/knowledge/files/<id>.<ext>  original upload (admin download only)
 *   data/knowledge/text/<id>.txt     extracted plain text used for answers
 * Redis mode (Vercel): the index is saved with the other stores by
 * lib/persist.ts; each document's text and (small enough) original file are
 * separate keys, written at the end of the request.
 * Files are stored under random ids, never under the uploaded file name.
 */
export interface KnowledgeDoc {
  id: string;
  title: string;
  fileName: string; // original name, display only
  ext: SupportedExtension | "text";
  size: number;
  sha256: string;
  enabled: boolean;
  chars: number;
  /** False when the original was too large to keep in Redis (text is kept). */
  hasOriginal?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Vercel rejects request bodies over 4.5 MB, and Redis values should stay
// well under Upstash's request size limit.
export const MAX_UPLOAD_BYTES = (useKv ? 4 : 10) * 1024 * 1024;
export const MAX_TEXT_CHARS = useKv ? 700_000 : 2_000_000;
const MAX_ORIGINAL_IN_KV = 700 * 1024;

export const KV_TEXT_PREFIX = "atlas:kb:text:";
export const KV_FILE_PREFIX = "atlas:kb:file:";

const root = path.join(process.cwd(), "data", "knowledge");
const indexFile = path.join(root, "index.json");
const filesDir = path.join(root, "files");
const textDir = path.join(root, "text");

interface KnowledgeState {
  docs: KnowledgeDoc[];
  chunks: Chunk[] | null;
  /** Extracted text by document id, tagged with the doc version it belongs to. */
  texts: Map<string, { stamp: string; text: string }>;
  /** Redis writes/deletes queued by this request (flushed by lib/persist.ts). */
  pending: (string | number)[][];
}

const store = globalThis as unknown as { atlasKnowledge?: KnowledgeState };

function state(): KnowledgeState {
  if (!store.atlasKnowledge) {
    let docs: KnowledgeDoc[] = [];
    if (!useKv) {
      try {
        const saved = JSON.parse(fs.readFileSync(indexFile, "utf8"));
        if (Array.isArray(saved.docs)) docs = saved.docs;
      } catch {
        // created on first upload
      }
    }
    store.atlasKnowledge = { docs, chunks: null, texts: new Map(), pending: [] };
  }
  return store.atlasKnowledge;
}

const stampOf = (doc: KnowledgeDoc) => `${doc.updatedAt}|${doc.sha256}`;

function saveIndex(docs: KnowledgeDoc[]) {
  state().docs = docs;
  state().chunks = null; // rebuild search index lazily
  if (useKv) {
    markDirty("knowledge");
    return;
  }
  fs.mkdirSync(root, { recursive: true });
  const tmp = `${indexFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ docs }, null, 2), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, indexFile);
}

const safeId = (id: string) => /^[0-9a-f-]{36}$/.test(id);
const textPath = (id: string) => path.join(textDir, `${id}.txt`);
const extOf = (doc: KnowledgeDoc) => (doc.ext === "text" ? "txt" : doc.ext);
const filePath = (doc: KnowledgeDoc) => path.join(filesDir, `${doc.id}.${extOf(doc)}`);

function writePrivate(file: string, data: Buffer | string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data, { mode: 0o600 });
}

/** Store a document's text and original file (disk, or queued for Redis). */
function storeContent(doc: KnowledgeDoc, text: string, buffer: Buffer) {
  state().texts.set(doc.id, { stamp: stampOf(doc), text });
  if (useKv) {
    state().pending.push(["SET", KV_TEXT_PREFIX + doc.id, text]);
    state().pending.push(
      doc.hasOriginal
        ? ["SET", KV_FILE_PREFIX + doc.id, buffer.toString("base64")]
        : ["DEL", KV_FILE_PREFIX + doc.id],
    );
    markDirty("knowledge");
    return;
  }
  writePrivate(filePath(doc), buffer);
  writePrivate(textPath(doc.id), text);
}

function removeContent(doc: KnowledgeDoc) {
  state().texts.delete(doc.id);
  if (useKv) {
    state().pending.push(["DEL", KV_TEXT_PREFIX + doc.id, KV_FILE_PREFIX + doc.id]);
    markDirty("knowledge");
    return;
  }
  for (const file of [filePath(doc), textPath(doc.id)]) {
    try {
      fs.unlinkSync(file);
    } catch {}
  }
}

export function listDocs(): KnowledgeDoc[] {
  return [...state().docs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getDoc(id: string): KnowledgeDoc | null {
  return safeId(id) ? state().docs.find((d) => d.id === id) ?? null : null;
}

export function getDocText(id: string): string | null {
  const doc = getDoc(id);
  if (!doc) return null;
  const cached = state().texts.get(id);
  if (cached && cached.stamp === stampOf(doc)) return cached.text;
  if (useKv) return null; // loaded by lib/persist.ts before the request runs
  try {
    const text = fs.readFileSync(textPath(id), "utf8");
    state().texts.set(id, { stamp: stampOf(doc), text });
    return text;
  } catch {
    return null;
  }
}

export async function getDocFile(id: string): Promise<{ doc: KnowledgeDoc; data: Buffer } | null> {
  const doc = getDoc(id);
  if (!doc || doc.hasOriginal === false) return null;
  try {
    if (useKv) {
      const b64 = await kv(["GET", KV_FILE_PREFIX + id]);
      return typeof b64 === "string" ? { doc, data: Buffer.from(b64, "base64") } : null;
    }
    return { doc, data: fs.readFileSync(filePath(doc)) };
  } catch {
    return null;
  }
}

// --- Shared-store hooks (lib/persist.ts) -----------------------------------

export function exportKnowledgeIndex(): KnowledgeDoc[] {
  return state().docs;
}

export function importKnowledgeIndex(docs: unknown): void {
  const s = state();
  const next = Array.isArray(docs) ? (docs as KnowledgeDoc[]) : [];
  const signature = (list: KnowledgeDoc[]) =>
    list.map((d) => `${d.id}|${stampOf(d)}|${d.enabled}`).join(",");
  if (signature(next) !== signature(s.docs)) s.chunks = null;
  s.docs = next;
}

/** Documents whose text is not cached in this server instance yet. */
export function docsMissingText(): KnowledgeDoc[] {
  const s = state();
  return s.docs.filter((d) => s.texts.get(d.id)?.stamp !== stampOf(d));
}

export function cacheDocTexts(entries: { doc: KnowledgeDoc; text: unknown }[]): void {
  const s = state();
  entries.forEach(({ doc, text }) => {
    if (typeof text === "string") s.texts.set(doc.id, { stamp: stampOf(doc), text });
  });
  if (entries.length) s.chunks = null;
}

/**
 * Redis is empty: load the knowledge base bundled in data/knowledge/ and queue
 * it (index, texts, small originals) to be saved to Redis.
 */
export function seedKnowledgeFromDisk(): void {
  const s = state();
  let docs: KnowledgeDoc[] = [];
  try {
    const saved = JSON.parse(fs.readFileSync(indexFile, "utf8"));
    if (Array.isArray(saved.docs)) docs = saved.docs;
  } catch {
    // no bundled knowledge base
  }
  const seeded: KnowledgeDoc[] = [];
  for (const doc of docs) {
    let text: string;
    try {
      text = fs.readFileSync(textPath(doc.id), "utf8");
    } catch {
      continue; // index entry without text: skip it
    }
    let original: Buffer | null = null;
    try {
      original = fs.readFileSync(filePath(doc));
    } catch {}
    const next: KnowledgeDoc = {
      ...doc,
      hasOriginal: !!original && original.length <= MAX_ORIGINAL_IN_KV,
    };
    s.texts.set(next.id, { stamp: stampOf(next), text });
    s.pending.push(["SET", KV_TEXT_PREFIX + next.id, text]);
    if (next.hasOriginal && original) {
      s.pending.push(["SET", KV_FILE_PREFIX + next.id, original.toString("base64")]);
    }
    seeded.push(next);
  }
  s.docs = seeded;
  s.chunks = null;
  markDirty("knowledge");
}

/** Redis writes queued by this request; the queue is emptied. */
export function takeKnowledgeWrites(): (string | number)[][] {
  const s = state();
  const pending = s.pending;
  s.pending = [];
  return pending;
}

// --- Editing ----------------------------------------------------------------

type Source = { kind: "file"; buffer: Buffer; fileName: string; ext: SupportedExtension } | { kind: "text"; text: string };

async function textFrom(source: Source): Promise<{ text: string; buffer: Buffer; ext: KnowledgeDoc["ext"]; fileName: string }> {
  if (source.kind === "text") {
    const buffer = Buffer.from(source.text, "utf8");
    return { text: source.text.trim(), buffer, ext: "text", fileName: "Text entry" };
  }
  const text = await extractText(source.buffer, source.ext);
  return { text, buffer: source.buffer, ext: source.ext, fileName: source.fileName };
}

function validateText(text: string): string | null {
  if (text.replace(/\s/g, "").length < 10) return "No readable text was found in this document.";
  if (text.length > MAX_TEXT_CHARS) {
    return `This document has too much text (limit ${MAX_TEXT_CHARS.toLocaleString()} characters). Split it into smaller documents.`;
  }
  return null;
}

function contentFields(buffer: Buffer, text: string, ext: KnowledgeDoc["ext"], fileName: string) {
  return {
    ext,
    fileName: fileName.slice(0, 200),
    size: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    chars: text.length,
    hasOriginal: !useKv || buffer.length <= MAX_ORIGINAL_IN_KV,
  };
}

export async function addDoc(title: string, source: Source): Promise<{ ok: true; doc: KnowledgeDoc } | { ok: false; error: string }> {
  const { text, buffer, ext, fileName } = await textFrom(source);
  const error = validateText(text);
  if (error) return { ok: false, error };
  const now = new Date().toISOString();
  const doc: KnowledgeDoc = {
    id: randomUUID(),
    title: title.trim().slice(0, 120) || fileName,
    ...contentFields(buffer, text, ext, fileName),
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
  storeContent(doc, text, buffer);
  saveIndex([...state().docs, doc]);
  return { ok: true, doc };
}

export async function updateDoc(
  id: string,
  changes: { title?: string; enabled?: boolean; source?: Source },
): Promise<{ ok: true; doc: KnowledgeDoc } | { ok: false; error: string; status?: number }> {
  const current = getDoc(id);
  if (!current) return { ok: false, error: "Document not found.", status: 404 };
  const next: KnowledgeDoc = { ...current, updatedAt: new Date().toISOString() };
  if (changes.title !== undefined) {
    const title = changes.title.trim().slice(0, 120);
    if (!title) return { ok: false, error: "A title is required." };
    next.title = title;
  }
  if (changes.enabled !== undefined) next.enabled = changes.enabled;
  if (changes.source) {
    const { text, buffer, ext, fileName } = await textFrom(changes.source);
    const error = validateText(text);
    if (error) return { ok: false, error };
    removeContent(current);
    Object.assign(next, contentFields(buffer, text, ext, fileName));
    storeContent(next, text, buffer);
  } else {
    // Same content, new version stamp: keep the cached text valid.
    const text = getDocText(id);
    if (text !== null) state().texts.set(id, { stamp: stampOf(next), text });
  }
  saveIndex(state().docs.map((d) => (d.id === id ? next : d)));
  return { ok: true, doc: next };
}

export function deleteDoc(id: string): boolean {
  const doc = getDoc(id);
  if (!doc) return false;
  removeContent(doc);
  saveIndex(state().docs.filter((d) => d.id !== id));
  return true;
}

// ---------------------------------------------------------------------------
// Retrieval: paragraph chunks ranked with BM25.

interface Chunk {
  docId: string;
  title: string;
  text: string;
  terms: Map<string, number>;
  length: number;
}

export interface KnowledgeHit {
  docId: string;
  title: string;
  text: string;
  score: number;
  coverage: number; // share of the question's keywords found in this passage
}

const STOPWORDS = new Set(
  (
    "a an the and or but if of to in on at by for with from about into over under is are was were be been being am do does did " +
    "have has had i me my we our you your he she it its they them their this that these those what which who whom whose when where why how " +
    "can could should would will shall may might must there here please tell know atlas campus cvsu imus school university any some " +
    "get give find show want need like also just than then so as not no yes hi hello thanks thank"
  ).split(" "),
);

export function terms(text: string): string[] {
  return (text.toLowerCase().normalize("NFKD").match(/[a-z0-9]+/g) ?? [])
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map((t) => (t.length > 4 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t));
}

function chunkText(text: string, size = 900): string[] {
  const paragraphs = text.split(/\n{2,}|\n(?=\s*(?:Q[:.]|\d+[.)]\s|[-•*]\s))/);
  const chunks: string[] = [];
  let current = "";
  for (const raw of paragraphs) {
    const p = raw.trim();
    if (!p) continue;
    if (current && current.length + p.length > size) {
      chunks.push(current);
      current = "";
    }
    if (p.length > size * 1.5) {
      for (let i = 0; i < p.length; i += size) chunks.push(p.slice(Math.max(0, i - 100), i + size));
    } else {
      current = current ? `${current}\n${p}` : p;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function chunks(): Chunk[] {
  const s = state();
  if (s.chunks) return s.chunks;
  s.chunks = s.docs
    .filter((d) => d.enabled)
    .flatMap((doc) =>
      chunkText(getDocText(doc.id) ?? "").map((text) => {
        const list = terms(`${doc.title} ${text}`);
        const tf = new Map<string, number>();
        list.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
        return { docId: doc.id, title: doc.title, text, terms: tf, length: list.length };
      }),
    );
  return s.chunks;
}

export function searchKnowledge(query: string, limit = 4): KnowledgeHit[] {
  const all = chunks();
  const q = [...new Set(terms(query))];
  if (all.length === 0 || q.length === 0) return [];
  const avg = all.reduce((sum, c) => sum + c.length, 0) / all.length || 1;
  const df = new Map(q.map((t) => [t, all.filter((c) => c.terms.has(t)).length]));
  const k1 = 1.4;
  const b = 0.75;
  return all
    .map((c) => {
      let score = 0;
      let matched = 0;
      for (const t of q) {
        const f = c.terms.get(t) ?? 0;
        if (!f) continue;
        matched += 1;
        const n = df.get(t) ?? 0;
        const idf = Math.log(1 + (all.length - n + 0.5) / (n + 0.5));
        score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * c.length) / avg));
      }
      return { docId: c.docId, title: c.title, text: c.text, score, coverage: matched / q.length };
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Passages relevant enough to answer from (at least half the keywords, or a strong match). */
export function relevantKnowledge(query: string, limit = 4): KnowledgeHit[] {
  const hits = searchKnowledge(query, limit);
  const qCount = new Set(terms(query)).size;
  return hits.filter((h) => h.coverage >= 0.5 || (qCount >= 4 && h.coverage >= 0.34 && h.score > 2));
}
