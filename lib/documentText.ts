import { inflateRawSync } from "node:zlib";

/**
 * Plain-text extraction for knowledge-base uploads.
 *
 * Supported: .txt .md .csv .json .html/.htm (direct), .docx .pptx .odt .odp
 * (zip + XML), .rtf (control words stripped), .pdf (pdf.js via unpdf) and
 * legacy .doc (best effort: readable text runs only).
 */
export const SUPPORTED_EXTENSIONS = [
  "txt",
  "md",
  "csv",
  "json",
  "html",
  "htm",
  "pdf",
  "docx",
  "doc",
  "pptx",
  "odt",
  "odp",
  "rtf",
] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export function extensionOf(fileName: string): SupportedExtension | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)
    ? (ext as SupportedExtension)
    : null;
}

export class ExtractionError extends Error {}

export async function extractText(
  buffer: Buffer,
  ext: SupportedExtension,
): Promise<string> {
  let text: string;
  switch (ext) {
    case "txt":
    case "md":
    case "csv":
    case "json":
      text = decodeText(buffer);
      break;
    case "html":
    case "htm":
      text = htmlToText(decodeText(buffer));
      break;
    case "rtf":
      text = rtfToText(decodeText(buffer));
      break;
    case "pdf":
      text = await pdfToText(buffer);
      break;
    case "docx":
      text = xmlToText(zipEntry(buffer, "word/document.xml"), "w:p");
      break;
    case "pptx": {
      const slides = zipEntries(buffer)
        .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.name))
        .sort((a, b) => slideNo(a.name) - slideNo(b.name));
      text = slides
        .map((s) => xmlToText(readEntry(buffer, s), "a:p"))
        .join("\n\n");
      break;
    }
    case "odt":
    case "odp":
      text = xmlToText(zipEntry(buffer, "content.xml"), "text:p|text:h");
      break;
    case "doc":
      text = legacyDocToText(buffer);
      break;
  }
  return normalize(text);
}

function slideNo(name: string): number {
  return Number(name.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
}

function decodeText(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString("utf16le");
  const text = buffer.toString("utf8");
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

/** Office XML: one line per paragraph element, tabs/breaks kept as spacing. */
function xmlToText(xml: string, paragraphTags: string): string {
  const para = new RegExp(`</(?:${paragraphTags})>`, "g");
  return decodeEntities(
    xml
      .replace(/<(w:tab|text:tab)\b[^>]*\/>/g, " ")
      .replace(/<(w:br|a:br|text:line-break)\b[^>]*\/>/g, "\n")
      .replace(para, "\n")
      .replace(/<[^>]+>/g, ""),
  );
}

function rtfToText(rtf: string): string {
  return rtf
    .replace(/\\par[d]?\b/g, "\n")
    .replace(/\\'([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\{\\\*[^{}]*\}/g, "")
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "");
}

/** Legacy Word 97-2003: keep runs of readable UTF-16LE text. */
function legacyDocToText(buffer: Buffer): string {
  const utf16 = buffer.toString("utf16le").match(/[\x20-\x7e -ɏ\r\n\t]{4,}/g) ?? [];
  const text = utf16.join("\n");
  if (text.replace(/\s/g, "").length >= 20) return text;
  const ascii = buffer.toString("latin1").match(/[\x20-\x7e\r\n\t]{6,}/g) ?? [];
  return ascii.join("\n");
}

async function pdfToText(buffer: Buffer): Promise<string> {
  const { extractText: pdfExtract, getDocumentProxy } = await import("unpdf");
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await pdfExtract(pdf, { mergePages: false });
    return (Array.isArray(text) ? text : [text]).join("\n\n");
  } catch {
    throw new ExtractionError("This PDF could not be read. It may be encrypted or damaged.");
  }
}

// ---------------------------------------------------------------------------
// Minimal ZIP reader (stored + deflate entries), enough for Office/ODF files.

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
}

function zipEntries(buffer: Buffer): ZipEntry[] {
  const minEocd = Math.max(0, buffer.length - 0xffff - 22);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= minEocd; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ExtractionError("The file is not a valid document archive.");
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    entries.push({ name, method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

const MAX_XML_BYTES = 50 * 1024 * 1024;

function readEntry(buffer: Buffer, entry: ZipEntry): string {
  const o = entry.localOffset;
  if (buffer.readUInt32LE(o) !== 0x04034b50) throw new ExtractionError("Corrupt document archive.");
  const start = o + 30 + buffer.readUInt16LE(o + 26) + buffer.readUInt16LE(o + 28);
  const data = buffer.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return data.toString("utf8");
  if (entry.method === 8) {
    return inflateRawSync(data, { maxOutputLength: MAX_XML_BYTES }).toString("utf8");
  }
  throw new ExtractionError("Unsupported compression in document archive.");
}

function zipEntry(buffer: Buffer, name: string): string {
  const entry = zipEntries(buffer).find((e) => e.name === name);
  if (!entry) throw new ExtractionError("The document has no readable text content.");
  return readEntry(buffer, entry);
}
