"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./Admin.module.css";
import { IconClose, IconDownload, IconPlus } from "./icons";

interface KnowledgeDoc {
  id: string;
  title: string;
  fileName: string;
  ext: string;
  size: number;
  enabled: boolean;
  chars: number;
  hasOriginal?: boolean;
  createdAt: string;
  updatedAt: string;
}

const ACCEPT = ".txt,.md,.csv,.json,.html,.htm,.pdf,.doc,.docx,.pptx,.odt,.odp,.rtf";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type Dialog =
  | { kind: "text"; doc?: KnowledgeDoc; title: string; text: string }
  | { kind: "view"; doc: KnowledgeDoc; text: string; title: string }
  | null;

export default function KnowledgeBase() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dialogError, setDialogError] = useState("");
  const [maxBytes, setMaxBytes] = useState(10 * 1024 * 1024);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ reply: string; sources: string[] } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<KnowledgeDoc | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/knowledge", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDocs(data.docs ?? []);
      if (typeof data.maxBytes === "number") setMaxBytes(data.maxBytes);
    } catch {
      setNotice({ kind: "error", text: "Couldn't load the knowledge base." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && setDialog(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, busy]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => !q || `${d.title} ${d.fileName}`.toLowerCase().includes(q));
  }, [docs, search]);

  const request = async (url: string, init: RequestInit) => {
    setBusy(true);
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Request failed.");
      return data;
    } finally {
      setBusy(false);
    }
  };

  const upload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (file.size > maxBytes) {
      setNotice({ kind: "error", text: `Files must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller.` });
      return;
    }
    const form = new FormData();
    form.set("file", file);
    if (uploadTitle.trim()) form.set("title", uploadTitle.trim());
    try {
      const data = await request("/api/admin/knowledge", { method: "POST", body: form });
      setNotice({
        kind: "ok",
        text: `Added “${data.doc.title}” (${data.doc.chars.toLocaleString()} characters extracted). The chatbot can use it now.`,
      });
      setFile(null);
      setUploadTitle("");
      if (fileInput.current) fileInput.current.value = "";
      await load();
    } catch (error) {
      setNotice({ kind: "error", text: (error as Error).message });
    }
  };

  const replaceFile = async (picked: File | undefined) => {
    const target = replaceTarget.current;
    if (!picked || !target) return;
    const form = new FormData();
    form.set("file", picked);
    try {
      await request(`/api/admin/knowledge/${target.id}`, { method: "PATCH", body: form });
      setNotice({ kind: "ok", text: `Replaced the content of “${target.title}”.` });
      await load();
    } catch (error) {
      setNotice({ kind: "error", text: (error as Error).message });
    } finally {
      if (replaceInput.current) replaceInput.current.value = "";
    }
  };

  const toggle = async (doc: KnowledgeDoc) => {
    try {
      await request(`/api/admin/knowledge/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !doc.enabled }),
      });
      setNotice({
        kind: "ok",
        text: doc.enabled
          ? `“${doc.title}” is hidden from the chatbot.`
          : `“${doc.title}” is available to the chatbot again.`,
      });
      await load();
    } catch (error) {
      setNotice({ kind: "error", text: (error as Error).message });
    }
  };

  const remove = async (doc: KnowledgeDoc) => {
    if (!window.confirm(`Permanently delete “${doc.title}”? The chatbot will stop using it. This cannot be undone.`))
      return;
    try {
      await request(`/api/admin/knowledge/${doc.id}`, { method: "DELETE" });
      setNotice({ kind: "ok", text: `Deleted “${doc.title}”.` });
      await load();
    } catch (error) {
      setNotice({ kind: "error", text: (error as Error).message });
    }
  };

  const openView = async (doc: KnowledgeDoc) => {
    try {
      const data = await request(`/api/admin/knowledge/${doc.id}`, { method: "GET" });
      setDialogError("");
      setDialog(
        doc.ext === "text"
          ? { kind: "text", doc, title: doc.title, text: data.text }
          : { kind: "view", doc, text: data.text, title: doc.title },
      );
    } catch (error) {
      setNotice({ kind: "error", text: (error as Error).message });
    }
  };

  const saveDialog = async (e: FormEvent) => {
    e.preventDefault();
    if (!dialog) return;
    setDialogError("");
    try {
      if (dialog.kind === "text" && !dialog.doc) {
        await request("/api/admin/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: dialog.title, text: dialog.text }),
        });
      } else if (dialog.doc) {
        await request(`/api/admin/knowledge/${dialog.doc.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            dialog.kind === "text" ? { title: dialog.title, text: dialog.text } : { title: dialog.title },
          ),
        });
      }
      setNotice({ kind: "ok", text: `Saved “${dialog.title}”.` });
      setDialog(null);
      await load();
    } catch (error) {
      setDialogError((error as Error).message);
    }
  };

  const ask = async (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    setAnswer(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const data = await res.json();
      setAnswer({ reply: data.reply ?? data.error ?? "No response.", sources: data.sources ?? [] });
    } catch {
      setAnswer({ reply: "Couldn't reach the chatbot.", sources: [] });
    } finally {
      setBusy(false);
    }
  };

  const enabledCount = docs.filter((d) => d.enabled).length;

  return (
    <>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Documents</span>
          <span className={styles.statValue}>{docs.length}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Used by chatbot</span>
          <span className={styles.statValue}>{enabledCount}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Text indexed</span>
          <span className={styles.statValue}>
            {docs
              .filter((d) => d.enabled)
              .reduce((sum, d) => sum + d.chars, 0)
              .toLocaleString()}
          </span>
        </div>
      </div>

      {notice && (
        <div
          className={`${styles.notice} ${notice.kind === "ok" ? styles.noticeOk : styles.noticeError}`}
          role={notice.kind === "error" ? "alert" : "status"}
        >
          <span style={{ flex: 1 }}>{notice.text}</span>
          <button type="button" className={styles.iconBtn} onClick={() => setNotice(null)} aria-label="Dismiss">
            <IconClose size={16} />
          </button>
        </div>
      )}

      <div className={styles.grid2}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2 className={styles.panelTitle}>Upload a document</h2>
              <p className={styles.panelHint}>
                PDF, Word (DOCX/DOC), PowerPoint (PPTX), OpenDocument, RTF, TXT, Markdown, CSV or HTML · up to {Math.round(maxBytes / 1024 / 1024)} MB.
              </p>
            </div>
          </div>
          <form onSubmit={upload} style={{ display: "grid", gap: 12 }}>
            <label
              className={`${styles.dropzone} ${dragging ? styles.dropzoneActive : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const dropped = e.dataTransfer.files[0];
                if (dropped) setFile(dropped);
              }}
            >
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPT}
                className={styles.srOnly}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <strong>{file ? file.name : "Drop a file here or click to browse"}</strong>
              <span>{file ? formatSize(file.size) : "Text is extracted automatically"}</span>
            </label>
            <input
              className={styles.input}
              placeholder="Title (optional — defaults to the file name)"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              maxLength={120}
            />
            <div className={styles.toolbar}>
              <button type="submit" className={styles.btn} disabled={!file || busy}>
                {busy && file ? "Processing…" : "Upload & process"}
              </button>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => {
                  setDialogError("");
                  setDialog({ kind: "text", title: "", text: "" });
                }}
              >
                <IconPlus size={16} /> Write an FAQ entry
              </button>
            </div>
          </form>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2 className={styles.panelTitle}>Test the chatbot</h2>
              <p className={styles.panelHint}>
                Ask what a student would ask. Answers come only from enabled documents.
              </p>
            </div>
          </div>
          <form onSubmit={ask} className={styles.inputRow}>
            <input
              className={styles.input}
              placeholder="e.g. When is enrollment?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={500}
            />
            <button type="submit" className={styles.btn} disabled={busy || !question.trim()}>
              Ask
            </button>
          </form>
          {answer && (
            <div className={`${styles.notice} ${styles.noticeInfo}`} style={{ marginTop: 12, display: "block" }}>
              <div style={{ whiteSpace: "pre-wrap" }}>{answer.reply}</div>
              <div className={styles.fieldHelp} style={{ marginTop: 6 }}>
                {answer.sources.length
                  ? `Sources: ${answer.sources.join(", ")}`
                  : "No knowledge-base source was used."}
              </div>
            </div>
          )}
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <h2 className={styles.panelTitle}>Knowledge base documents</h2>
            <p className={styles.panelHint}>Disable a document to hide it from the chatbot without deleting it.</p>
          </div>
          <input
            className={styles.input}
            placeholder="Search documents"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search documents"
            style={{ maxWidth: 260 }}
          />
        </div>
        <input
          ref={replaceInput}
          type="file"
          accept={ACCEPT}
          className={styles.srOnly}
          onChange={(e) => replaceFile(e.target.files?.[0])}
        />
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Size</th>
                <th>Status</th>
                <th>Updated</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <span className={styles.cellMain}>{doc.title}</span>
                    <span className={styles.cellSub}>
                      {doc.ext === "text" ? "Written in dashboard" : doc.fileName} · {doc.chars.toLocaleString()} chars
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.pill} ${styles.pillMuted}`}>
                      {doc.ext === "text" ? "FAQ" : doc.ext.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatSize(doc.size)}</td>
                  <td>
                    <span className={`${styles.pill} ${doc.enabled ? styles.pillOk : styles.pillMuted}`}>
                      {doc.enabled ? "In use" : "Disabled"}
                    </span>
                  </td>
                  <td>{new Date(doc.updatedAt).toLocaleDateString()}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <button type="button" className={styles.btnSm} onClick={() => openView(doc)} disabled={busy}>
                        {doc.ext === "text" ? "Edit" : "View"}
                      </button>
                      {doc.ext !== "text" && (
                        <button
                          type="button"
                          className={styles.btnSm}
                          disabled={busy}
                          onClick={() => {
                            replaceTarget.current = doc;
                            replaceInput.current?.click();
                          }}
                        >
                          Replace file
                        </button>
                      )}
                      {doc.hasOriginal !== false && (
                      <a
                        className={styles.btnSm}
                        href={`/api/admin/knowledge/${doc.id}?download=1`}
                        aria-label={`Download ${doc.title}`}
                        title="Download original"
                      >
                        <IconDownload size={14} />
                      </a>
                      )}
                      <button type="button" className={styles.btnSm} onClick={() => toggle(doc)} disabled={busy}>
                        {doc.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        className={`${styles.btnSm} ${styles.btnDanger}`}
                        onClick={() => remove(doc)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && visible.length === 0 && (
            <div className={styles.empty}>
              {docs.length === 0
                ? "No documents yet. Upload campus FAQs, handbooks or announcements so the chatbot can answer from them."
                : "No documents match your search."}
            </div>
          )}
          {loading && <div className={styles.empty}>Loading documents…</div>}
        </div>
      </section>

      {dialog && (
        <div
          className={styles.overlay}
          onMouseDown={(e) => e.target === e.currentTarget && !busy && setDialog(null)}
        >
          <form
            className={`${styles.dialog} ${styles.dialogWide}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="kb-dialog-title"
            onSubmit={saveDialog}
          >
            <div className={styles.dialogHead}>
              <div>
                <h2 id="kb-dialog-title" className={styles.panelTitle}>
                  {dialog.kind === "view" ? "Document details" : dialog.doc ? "Edit FAQ entry" : "Write an FAQ entry"}
                </h2>
                <p className={styles.panelHint}>
                  {dialog.kind === "view"
                    ? `${dialog.doc.fileName} · extracted text the chatbot reads (read-only — replace the file to change it).`
                    : "Plain text. Tip: write questions and answers as “Q: … / A: …” pairs."}
                </p>
              </div>
              <button type="button" className={styles.iconBtn} onClick={() => setDialog(null)} aria-label="Close">
                <IconClose />
              </button>
            </div>
            <div className={styles.dialogBody}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Title</span>
                <input
                  className={styles.input}
                  value={dialog.title}
                  onChange={(e) => setDialog({ ...dialog, title: e.target.value })}
                  maxLength={120}
                  required
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{dialog.kind === "view" ? "Extracted text" : "Content"}</span>
                <textarea
                  className={`${styles.input} ${styles.textarea}`}
                  value={dialog.text}
                  readOnly={dialog.kind === "view"}
                  onChange={(e) => dialog.kind === "text" && setDialog({ ...dialog, text: e.target.value })}
                  required={dialog.kind === "text"}
                  rows={14}
                />
              </label>
              {dialogError && (
                <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
                  {dialogError}
                </div>
              )}
            </div>
            <div className={styles.dialogFoot}>
              <button type="button" className={styles.btnGhost} onClick={() => setDialog(null)} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className={styles.btn} disabled={busy}>
                {busy ? "Saving…" : dialog.kind === "view" ? "Save title" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
