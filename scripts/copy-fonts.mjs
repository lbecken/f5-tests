// Copies Excalidraw's self-hosted fonts into public/ so the app never falls
// back to fetching them from a CDN (works fully offline). Runs before dev/build.
import { cpSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(
  root,
  "node_modules/@excalidraw/excalidraw/dist/prod/fonts",
);
const dest = join(root, "public/fonts");

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log("Copied Excalidraw fonts -> public/fonts");
