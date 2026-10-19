import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");
const htmlPath = resolve(output, "index.html");
let html = await readFile(htmlPath, "utf8");

// Vite's entry bundle has no external imports in this app. Inline the bundle
// and all presentation assets so the prototype also works when opened as a file.
const assets = await readdir(resolve(output, "assets"));
const scripts = assets.filter((name) => name.endsWith(".js"));
if (scripts.length !== 1) {
  throw new Error(
    "Expected one entry bundle. Review standalone packaging after adding code splitting.",
  );
}

const scriptTag = /<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g;
const scriptMatches = [...html.matchAll(scriptTag)];
if (scriptMatches.length !== 1) throw new Error("Expected one script entry.");
const script = await readFile(
  resolve(output, scriptMatches[0][1].replace(/^\//, "")),
  "utf8",
);
html = html.replace(
  scriptMatches[0][0],
  () =>
    `<script type="module">${script.replace(/<\/script/gi, "<\\/script")}</script>`,
);

const stylesheetTag =
  /<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g;
for (const match of [...html.matchAll(stylesheetTag)]) {
  let css = await readFile(
    resolve(output, match[1].replace(/^\//, "")),
    "utf8",
  );
  for (const asset of [
    ...css.matchAll(/url\((['"]?)(\/fonts\/[^)'"\s]+)\1\)/g),
  ]) {
    const font = await readFile(resolve(output, asset[2].replace(/^\//, "")));
    css = css.replace(
      asset[0],
      `url("data:font/ttf;base64,${font.toString("base64")}")`,
    );
  }
  html = html.replace(match[0], () => `<style>${css}</style>`);
}

const favicon = await readFile(resolve(output, "favicon.svg"));
html = html.replace(
  'href="/favicon.svg"',
  `href="data:image/svg+xml;base64,${favicon.toString("base64")}"`,
);
const fontLicense = await readFile(
  resolve(output, "fonts/LICENSE.txt"),
  "utf8",
);
html = html.replace(
  "</body>",
  () =>
    `<script type="text/plain" id="open-sans-license">${fontLicense.replace(/<\/script/gi, "<\\/script")}</script></body>`,
);
if (
  /\b(?:src|href)="\/(?:assets|fonts)\//.test(html) ||
  /url\(\/?fonts\//.test(html)
) {
  throw new Error("An external asset remains in the standalone HTML.");
}

const destination = resolve(output, "aurelia-hotel.html");
await writeFile(destination, html);
// Keep a complete, tracked copy at the repository root for GitHub downloads.
await writeFile(resolve(root, "aurelia-hotel.html"), html);
console.log(`Standalone prototype written to ${destination}`);
console.log(
  `GitHub download copy written to ${resolve(root, "aurelia-hotel.html")}`,
);
