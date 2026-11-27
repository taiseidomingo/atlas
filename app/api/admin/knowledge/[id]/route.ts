import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ExtractionError } from "@/lib/documentText";
import { deleteDoc, getDoc, getDocFile, getDocText, updateDoc } from "@/lib/knowledgeBase";
import { readUpload } from "@/lib/knowledgeUpload";
import { withSharedState } from "@/lib/persist";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  odp: "application/vnd.oasis.opendocument.presentation",
  rtf: "application/rtf",
};

/** Extracted text (default) or ?download=1 for the original file. Admin only. */
async function handleGET(request: NextRequest, context: Context) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await context.params;
  const doc = getDoc(id);
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  if (new URL(request.url).searchParams.get("download")) {
    const file = await getDocFile(id);
    if (!file) {
      return NextResponse.json(
        { error: doc.hasOriginal === false ? "The original file was too large to keep; its extracted text is still used." : "Original file is missing." },
        { status: 404 },
      );
    }
    const ext = doc.ext === "text" ? "txt" : doc.ext;
    const base = doc.title.replace(/[^\w.\- ]+/g, "_").slice(0, 80) || "document";
    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        // Never served inline: always a download, never sniffed as HTML.
        "Content-Type": MIME[ext] ?? "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.${ext}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      },
    });
  }
  return NextResponse.json({ doc, text: getDocText(id) ?? "" }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * JSON { title?, enabled?, text? } to edit, or multipart `file` to replace
 * the document's content (text is re-extracted).
 */
async function handlePATCH(request: NextRequest, context: Context) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await context.params;
  try {
    const type = request.headers.get("content-type") ?? "";
    let changes: Parameters<typeof updateDoc>[1];
    if (type.includes("multipart/form-data")) {
      const upload = await readUpload(request);
      if ("error" in upload) return NextResponse.json({ error: upload.error }, { status: 400 });
      changes = { source: upload.source };
    } else {
      const body = await request.json().catch(() => ({}));
      changes = {
        ...(typeof body.title === "string" ? { title: body.title } : {}),
        ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {}),
        ...(typeof body.text === "string" ? { source: { kind: "text" as const, text: body.text } } : {}),
      };
    }
    const result = await updateDoc(id, changes);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
    return NextResponse.json({ doc: result.doc });
  } catch (error) {
    const message =
      error instanceof ExtractionError ? error.message : "The document could not be processed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

async function handleDELETE(request: NextRequest, context: Context) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await context.params;
  if (!deleteDoc(id)) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export const GET = withSharedState(handleGET);
export const PATCH = withSharedState(handlePATCH);
export const DELETE = withSharedState(handleDELETE);
