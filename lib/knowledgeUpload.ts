import type { NextRequest } from "next/server";
import { extensionOf, SUPPORTED_EXTENSIONS, type SupportedExtension } from "./documentText";
import { MAX_TEXT_CHARS, MAX_UPLOAD_BYTES } from "./knowledgeBase";

export type UploadSource =
  | { kind: "file"; buffer: Buffer; fileName: string; ext: SupportedExtension }
  | { kind: "text"; text: string };

/**
 * Reads a knowledge-base upload: multipart form data with `file` (+ `title`),
 * or JSON { title, text } for an entry typed in the dashboard.
 */
export async function readUpload(
  request: NextRequest,
): Promise<{ title: string; source: UploadSource } | { error: string }> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    const title = String(form.get("title") ?? "").trim();
    if (!(file instanceof File)) return { error: "Choose a file to upload." };
    if (file.size > MAX_UPLOAD_BYTES) return { error: `Files must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller.` };
    const ext = extensionOf(file.name);
    if (!ext) return { error: `Unsupported file type. Use: ${SUPPORTED_EXTENSIONS.join(", ")}.` };
    return {
      title: title || file.name.replace(/\.[^.]+$/, ""),
      source: { kind: "file", buffer: Buffer.from(await file.arrayBuffer()), fileName: file.name, ext },
    };
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body.text !== "string" || !body.text.trim()) return { error: "Enter some text." };
  if (body.text.length > MAX_TEXT_CHARS) return { error: "That text is too long." };
  return { title: typeof body.title === "string" ? body.title.trim() : "", source: { kind: "text", text: body.text } };
}
