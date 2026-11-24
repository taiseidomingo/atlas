import fs from "node:fs";
import path from "node:path";
import type { CapacitorConfig } from "@capacitor/cli";

/**
 * ATLAS native shell (Android / iOS).
 *
 * The app needs the Next.js server (API routes, cookie auth, server state), so the
 * native shell loads the running website via `server.url` instead of bundling files.
 * The origin is therefore identical to the website: same cookies, same backend.
 *
 * Choose the target with CAP_TARGET:
 *   emulator (default)  Android emulator -> http://10.0.2.2:3000
 *   device              physical device  -> http://<CAP_DEV_HOST>:3000  (LAN IP, or
 *                       localhost when using `adb reverse tcp:3000 tcp:3000`)
 *   prod                deployed site    -> CAP_PROD_URL (must be https)
 *   custom              CAP_SERVER_URL as given
 * Values are read from the shell or from ./.env.capacitor (see .env.capacitor.example).
 */
function loadEnvFile(file: string): void {
  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  }
}
loadEnvFile(".env.capacitor");

const PORT = process.env.CAP_DEV_PORT ?? "3000";
const target = (process.env.CAP_TARGET ?? "emulator").toLowerCase();

function resolveUrl(): string {
  switch (target) {
    case "prod":
    case "production": {
      const url = process.env.CAP_PROD_URL;
      if (!url) throw new Error("CAP_TARGET=prod requires CAP_PROD_URL (https://...)");
      if (!url.startsWith("https://")) {
        throw new Error("CAP_PROD_URL must start with https:// for release builds");
      }
      return url.replace(/\/$/, "");
    }
    case "device":
      return `http://${process.env.CAP_DEV_HOST ?? "localhost"}:${PORT}`;
    case "custom":
      if (!process.env.CAP_SERVER_URL) throw new Error("CAP_TARGET=custom requires CAP_SERVER_URL");
      return process.env.CAP_SERVER_URL.replace(/\/$/, "");
    default:
      return `http://10.0.2.2:${PORT}`;
  }
}

const url = resolveUrl();
const isHttp = url.startsWith("http://");

const config: CapacitorConfig = {
  appId: process.env.CAP_APP_ID ?? "ph.edu.cvsu.atlas",
  appName: "ATLAS",
  webDir: "www",
  server: {
    url,
    // Plain HTTP is only ever allowed for local development targets.
    cleartext: isHttp,
    errorPath: "offline.html",
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#f4f7fd",
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#f4f7fd",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#2433c4",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#f4f7fd",
      overlaysWebView: false,
    },
  },
};

export default config;
