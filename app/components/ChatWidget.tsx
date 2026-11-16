"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "./ChatWidget.module.css";

interface Msg {
  from: "me" | "bot";
  text: string;
}

interface NavigationRequest {
  startId?: string;
  destinationId: string;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      from: "bot",
      text: "Hi! I'm ATLAS. Ask me where a professor is, or how to get around campus.",
    },
  ]);
  const [pendingDestination, setPendingDestination] = useState<string | null>(
    null,
  );
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener("atlas:open-chat", openChat);
    return () => window.removeEventListener("atlas:open-chat", openChat);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, open]);

  const openNavigation = (navigation: NavigationRequest) => {
    const params = new URLSearchParams({ to: navigation.destinationId });
    if (navigation.startId) params.set("from", navigation.startId);
    window.location.assign(`/navigation?${params.toString()}`);
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { from: "me", text }]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          destinationId: pendingDestination ?? undefined,
        }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { from: "bot", text: data.reply ?? data.error ?? "No response." },
      ]);
      const navigation = data.navigation as NavigationRequest | null | undefined;
      if (navigation?.startId) {
        setPendingDestination(null);
        openNavigation(navigation);
      } else if (navigation?.destinationId) {
        setPendingDestination(navigation.destinationId);
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            () => openNavigation(navigation),
            () =>
              setMessages((m) => [
                ...m,
                {
                  from: "bot",
                  text: "Where are you right now? Tell me your room, building, or gate.",
                },
              ]),
            { maximumAge: 60_000, timeout: 3_000 },
          );
        } else {
          setMessages((m) => [
            ...m,
            {
              from: "bot",
              text: "Where are you right now? Tell me your room, building, or gate.",
            },
          ]);
        }
      }
    } catch {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "I couldn't reach the server. Please try again." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className={styles.fab}
        onClick={() => setOpen(true)}
      >
        💬 Ask ATLAS
      </button>
    );
  }

  return (
    <section className={styles.panel} aria-label="ATLAS Assistant">
      <div className={styles.head}>
        <span>ATLAS Assistant</span>
        <button
          type="button"
          className={styles.close}
          onClick={() => setOpen(false)}
          aria-label="Close chat"
        >
          ✕
        </button>
      </div>
      <div className={styles.log} ref={logRef} aria-live="polite">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`${styles.msg} ${m.from === "me" ? styles.me : styles.bot}`}
          >
            {m.text}
          </div>
        ))}
        {busy && <div className={`${styles.msg} ${styles.bot}`}>Thinking…</div>}
      </div>
      <form className={styles.form} onSubmit={send}>
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Where is Dr. Santos?"
          aria-label="Message"
        />
        <button className="btn" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}
