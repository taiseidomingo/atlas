import { kvToken, kvUrl } from "./storeMode";

/** One Upstash Redis REST command, e.g. ["GET", "key"]. */
export async function kv(command: (string | number)[]): Promise<unknown> {
  const response = await fetch(kvUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${kvToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as {
    result?: unknown;
    error?: string;
  };
  if (!response.ok || data.error) {
    throw new Error(`Redis ${command[0]} failed: ${data.error ?? `HTTP ${response.status}`}`);
  }
  return data.result;
}

/** Several commands in one round trip (Upstash pipeline endpoint). */
export async function kvPipeline(commands: (string | number)[][]): Promise<unknown[]> {
  if (commands.length === 0) return [];
  const response = await fetch(`${kvUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${kvToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Redis pipeline failed: HTTP ${response.status}`);
  const results = (await response.json()) as { result?: unknown; error?: string }[];
  const failed = results.find((r) => r.error);
  if (failed) throw new Error(`Redis pipeline failed: ${failed.error}`);
  return results.map((r) => r.result);
}
