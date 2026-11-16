"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { selectGroups } from "./CampusMap";

const places = selectGroups.flatMap((g) =>
  g.options.map((o) => ({ id: o.id, name: o.name, group: g.label })),
);

export default function HomeSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

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
