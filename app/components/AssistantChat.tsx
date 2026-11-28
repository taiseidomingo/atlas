"use client";

import { FormEvent, Fragment, useEffect, useRef, useState } from "react";
import { chat, useChat, type ChatMessage } from "@/lib/chatStore";
import { nav, useNav } from "@/lib/navStore";
import Icon from "./Icon";
import styles from "./Assistant.module.css";

/** **bold**, line breaks and "• " bullets — all the formatting replies use. */
function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={j}>{part.slice(2, -2)}</strong>
          ) : (
            <Fragment key={j}>{part}</Fragment>
          ),
        );
        if (line.trim() === "") return <span key={i} className={styles.gap} />;
        if (line.startsWith("• ")) {
          return (
            <span key={i} className={styles.bullet}>
              {parts}
            </span>
          );
        }
        return (
          <span key={i} className={styles.line}>
            {parts}
          </span>
        );
      })}
    </>
  );
}

function RouteCard({
  message,
  expanded,
  onShow,
}: {
  message: ChatMessage;
  expanded: boolean;
  onShow: () => void;
}) {
  const route = message.route!;
  const [open, setOpen] = useState(expanded);
  return (
    <div className={styles.routeCard}>
      <div className={styles.routeEnds}>
        <span className={styles.endA}>A</span>
        <span className={styles.endName}>{route.startName}</span>
        <Icon name="arrowRight" size={14} className={styles.endArrow} />
        <span className={styles.endB}>B</span>
        <span className={styles.endName}>{route.destinationName}</span>
      </div>
      <div className={styles.routeStats}>
        <span>
          <Icon name="walk" size={16} /> {Math.round(route.distance)} m
        </span>
        <span>
          <Icon name="clock" size={16} /> ~{route.minutes} min
        </span>
      </div>
      {open && (
        <ol className={styles.steps}>
          {route.steps.map((step, i) => (
            <li key={i}>
              <RichText text={step} />
            </li>
          ))}
        </ol>
      )}
      <div className={styles.cardActions}>
        <button type="button" className={styles.textBtn} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Hide steps" : `${route.steps.length} steps`}
        </button>
        <button type="button" className={styles.textBtn} onClick={onShow}>
          Show on map
        </button>
      </div>
    </div>
  );
}

export default function AssistantChat({
  onClose,
  onMapRequest,
  compact = false,
  autoFocus = false,
  onExpand,
}: {
  /** Shown as a close button in the header (floating chat). */
  onClose?: () => void;
  /** The user asked to see something on the map. */
  onMapRequest?: () => void;
  /** Latest reply + composer only (collapsed mobile sheet). */
  compact?: boolean;
  autoFocus?: boolean;
  /** Open the full conversation (collapsed sheet). */
  onExpand?: () => void;
}) {
  const { messages, busy } = useChat();
  const { picking, candidate } = useNav();
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy, compact]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy) return;
    chat.send(input);
    setInput("");
  };

  const lastBot = [...messages].reverse().find((m) => m.from === "bot");

  return (
    <section className={`${styles.chat} ${compact ? styles.compact : ""}`} aria-label="ATLAS Assistant">
      {onClose && (
        <header className={styles.head}>
          <div className={styles.headText}>
            <strong>Ask ATLAS</strong>
          </div>
          <button type="button" className={styles.iconBtn} onClick={() => chat.reset()} title="New conversation" aria-label="New conversation">
            <Icon name="refresh" size={18} />
          </button>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close chat" title="Close">
            <Icon name="x" size={20} />
          </button>
        </header>
      )}

      {!compact && (
        <div className={styles.log} ref={logRef} aria-live="polite">
          {messages.map((m) => (
            <div key={m.id} className={`${styles.row} ${m.from === "me" ? styles.rowMe : styles.rowBot}`}>
              <div className={styles.stack}>
                <div className={`${styles.bubble} ${m.from === "me" ? styles.me : styles.bot} ${m.error ? styles.error : ""}`}>
                  <RichText text={m.text} />
                  {m.sources && <div className={styles.sources}>Source: {m.sources.join(", ")}</div>}
                </div>

                {m.place && !m.route && m.id === lastBot?.id && !busy && (
                  <div className={styles.inlineActions}>
                    <button
                      type="button"
                      className={styles.cardBtnPrimary}
                      onClick={() => chat.directionsTo(m.place!.id, m.place!.name)}
                    >
                      <Icon name="route" size={15} /> Directions
                    </button>
                    <button
                      type="button"
                      className={styles.textBtn}
                      onClick={() => {
                        nav.showPlace(m.place!.id);
                        onMapRequest?.();
                      }}
                    >
                      Show on map
                    </button>
                  </div>
                )}

                {m.route && m.id === lastBot?.id && (
                  <RouteCard
                    message={m}
                    expanded={false}
                    onShow={() => {
                      nav.showRoute(m.route!.startId, m.route!.destinationId);
                      onMapRequest?.();
                    }}
                  />
                )}

                {m.options && m.id === lastBot?.id && (
                  <div className={styles.options} role="list">
                    {m.options.map((o, i) => (
                      <button
                        key={`${o.label}-${i}`}
                        type="button"
                        role="listitem"
                        className={styles.option}
                        disabled={busy}
                        onClick={() => chat.choose(o)}
                      >
                        <span className={styles.optionNum}>{i + 1}</span>
                        <span className={styles.optionText}>
                          <strong>{o.label}</strong>
                          {o.sublabel && <span>{o.sublabel}</span>}
                        </span>
                        <Icon name="arrowRight" size={16} className={styles.optionGo} />
                      </button>
                    ))}
                  </div>
                )}

                {m.quickReplies && m.id === lastBot?.id && !busy && !m.options && (
                  <div className={styles.quick}>
                    {m.quickReplies.slice(0, 2).map((q) => (
                      <button key={q} type="button" className={styles.chip} onClick={() => chat.send(q)}>
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className={`${styles.row} ${styles.rowBot}`}>
              <div className={`${styles.bubble} ${styles.bot} ${styles.typing}`} aria-label="ATLAS is typing">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
        </div>
      )}

      {compact && !picking && lastBot && (
        <div className={styles.preview}>
          <button type="button" className={styles.previewMsg} onClick={onExpand} aria-label="Open conversation">
            <span className={styles.previewText}>
              {busy ? "Thinking…" : <RichText text={lastBot.text.split("\n\n")[0]} />}
            </span>
            <Icon name="chevronUp" size={18} className={styles.previewChevron} />
          </button>
          {!busy && lastBot.quickReplies && !lastBot.route && (
            <div className={styles.previewChips}>
              {lastBot.quickReplies.slice(0, 2).map((q) => (
                <button key={q} type="button" className={styles.chip} onClick={() => chat.send(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {picking && (
        <div className={styles.pickHint} role="status">
          <Icon name="locate" size={18} />
          <span>{candidate ? "Confirm your starting point on the map." : "Tap your current location on the map."}</span>
          <button type="button" className={styles.linkBtn} onClick={() => nav.cancelPick()}>
            Cancel
          </button>
        </div>
      )}

      <form className={styles.composer} onSubmit={submit}>
        <input
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={picking ? "Or type where you are" : "Search or ask ATLAS"}
          aria-label="Message ATLAS"
          enterKeyHint="send"
          maxLength={500}
        />
        <button className={styles.send} disabled={busy || !input.trim()} aria-label="Send">
          <Icon name="send" size={18} />
        </button>
      </form>
    </section>
  );
}

