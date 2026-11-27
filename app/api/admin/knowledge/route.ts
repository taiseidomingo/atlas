import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ExtractionError, SUPPORTED_EXTENSIONS } from "@/lib/documentText";
import { addDoc, listDocs, MAX_UPLOAD_BYTES } from "@/lib/knowledgeBase";
import { readUpload } from "@/lib/knowledgeUpload";
import { withSharedState } from "@/lib/persist";

export const runtime = "nodejs";

async function handleGET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  return NextResponse.json(
    { docs: listDocs(), extensions: SUPPORTED_EXTENSIONS, maxBytes: MAX_UPLOAD_BYTES },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Add a document: multipart `file` (+ `title`) or JSON { title, text }. */
async function handlePOST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const upload = await readUpload(request);
    if ("error" in upload) return NextResponse.json({ error: upload.error }, { status: 400 });
    if (!upload.title && upload.source.kind === "text") {
      return NextResponse.json({ error: "A title is required." }, { status: 400 });
    }
    const result = await addDoc(upload.title, upload.source);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ doc: result.doc }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof ExtractionError ? error.message : "The document could not be processed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const GET = withSharedState(handleGET);
export const POST = withSharedState(handlePOST);
