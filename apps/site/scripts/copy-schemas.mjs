import { cpSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(siteRoot, "../../schemas");
const target = resolve(siteRoot, "dist/schemas");

mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });

console.log(`Copied Folio schemas to ${target}`);
