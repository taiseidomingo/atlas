

import fs from "node:fs";
import path from "node:path";

const env = path.resolve(".env.capacitor");
if (fs.existsSync(env)) {
  for (const line of fs.readFileSync(env, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}
const port = process.env.CAP_DEV_PORT ?? "3000";
const t = (process.env.CAP_TARGET ?? "emulator").toLowerCase();
const url =
  t.startsWith("prod") ? process.env.CAP_PROD_URL :
  t === "device" ? `http://${process.env.CAP_DEV_HOST ?? "localhost"}:${port}` :
  t === "custom" ? process.env.CAP_SERVER_URL :
  `http://10.0.2.2:${port}`;
fs.writeFileSync("www/config.js", `window.ATLAS_SERVER_URL=${JSON.stringify(url ?? "")};\n`);
console.log(`[atlas] target=${t} url=${url}`);
