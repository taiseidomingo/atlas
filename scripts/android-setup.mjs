import fs from "node:fs";

const file = "android/app/src/main/AndroidManifest.xml";
if (!fs.existsSync(file)) {
  console.error("android/ not found. Run: npx cap add android");
  process.exit(1);
}
let xml = fs.readFileSync(file, "utf8");
const perms = [
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
];
for (const p of perms) {
  if (!xml.includes(p)) {
    xml = xml.replace("</manifest>", `    <uses-permission android:name="${p}" />\n</manifest>`);
  }
}
fs.writeFileSync(file, xml);
console.log("[atlas] Android manifest permissions OK");
