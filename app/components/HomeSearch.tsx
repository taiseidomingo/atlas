"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { displayName } from "@/lib/locationNames";
import { buildSelectGroups } from "./CampusMap";

export default function HomeSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});

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
    return () => { cancelled = true; };
  }, []);

  const places = useMemo(
    () => buildSelectGroups(names).flatMap((group) =>
      group.options.map((option) => ({
        id: option.id,
        name: displayName(names, option.id, option.name),
        group: group.label,
      })),
    ),
    [names],
  );

  const matches = query.trim()
    ? places
        .filter((p) =>
          p.name.toLowerCase().includes(query.trim().toLowerCase()),
        )
        .slice(0, 6)
    : [];

  const go = (id: string) =>
    router.push(`/navigation?to=${encodeURIComponent(id)}`);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (matches[0]) go(matches[0].id);
  };

  return (
    <form
      onSubmit={submit}
      style={{
        maxWidth: 560,
        margin: "0 auto",
        position: "relative",
        textAlign: "left",
      }}
    >
      <input
        className="input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a room or place, e.g. Room 202"
        aria-label="Search places"
        style={{ padding: "15px 18px", fontSize: "1.02rem" }}
      />
      {matches.length > 0 && (
        <ul
          className="card"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "110%",
            margin: 0,
            padding: 6,
            listStyle: "none",
            zIndex: 5,
          }}
        >
          {matches.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="btnGhost"
                style={{ width: "100%", textAlign: "left", border: 0 }}
                onClick={() => go(m.id)}
              >
                {m.name}{" "}
                <span style={{ color: "var(--muted)", fontSize: "0.85em" }}>
                  · {m.group}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
