"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { displayName } from "@/lib/locationNames";
import { buildSelectGroups } from "./CampusMap";
import Icon from "./Icon";
import styles from "./HomeSearch.module.css";

const QUICK = ["Where is the Library?", "Room 204"];

export function askAtlas(question: string) {
  window.dispatchEvent(new CustomEvent("atlas:open-chat", { detail: { question } }));
}

export default function HomeSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/names")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.names && typeof data.names === "object") {
          setNames(data.names);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const places = useMemo(
    () =>
      buildSelectGroups(names).flatMap((group) =>
        group.options.map((option) => ({
          id: option.id,
          name: displayName(names, option.id, option.name),
          group: group.label,
        })),
      ),
    [names],
  );

  const q = query.trim().toLowerCase();
  const matches = q
    ? places
        .filter((p) => p.name.toLowerCase().includes(q))
        .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)))
        .slice(0, 6)
    : [];

  const go = (id: string) => router.push(`/navigation?to=${encodeURIComponent(id)}`);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (matches[active]) go(matches[active].id);
    else if (query.trim()) askAtlas(query.trim());
  };

  return (
    <div className={styles.wrap}>
      <form onSubmit={submit} className={styles.form} role="search">
        <Icon name="search" size={20} className={styles.searchIcon} />
        <input
          className={styles.input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, Math.max(0, matches.length - 1)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            }
          }}
          placeholder="Search a room, office or building"
          aria-label="Search places"
          aria-autocomplete="list"
          aria-controls="home-search-results"
        />
        <button type="submit" className={styles.go} aria-label="Search" disabled={!query.trim()}>
          <Icon name="arrowRight" size={20} />
        </button>

        {q && (
          <ul className={styles.results} id="home-search-results" role="listbox">
            {matches.map((m, i) => (
              <li key={m.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  className={`${styles.result} ${i === active ? styles.resultOn : ""}`}
                  onClick={() => go(m.id)}
                  onMouseEnter={() => setActive(i)}
                >
                  <span className={styles.resultIcon}>
                    <Icon name="pin" size={16} />
                  </span>
                  <span className={styles.resultText}>
                    <strong>{m.name}</strong>
                    <span>{m.group}</span>
                  </span>
                  <Icon name="arrowRight" size={16} className={styles.resultGo} />
                </button>
              </li>
            ))}
            <li>
              <button type="button" className={`${styles.result} ${styles.ask}`} onClick={() => askAtlas(query.trim())}>
                <span className={styles.resultIcon}>
                  <Icon name="sparkle" size={16} />
                </span>
                <span className={styles.resultText}>
                  <strong>Ask ATLAS: “{query.trim()}”</strong>
                  <span>Professors, directions and campus questions</span>
                </span>
              </button>
            </li>
          </ul>
        )}
      </form>
      <div className="heroChips">
        <span>Try</span>
        {QUICK.map((question) => (
          <button key={question} type="button" onClick={() => askAtlas(question)}>
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
