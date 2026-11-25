#!/usr/bin/env node
import { cpSync, existsSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HELP = `Create a Folio site

Usage:
  npx @uichat-mira/create-folio <project-name> [--install]
  npm create @uichat-mira/folio <project-name> [-- --install]

Options:
  --install    Run npm install after creating the site
  --help       Print this help

The target must be a new directory in the current working directory.
No existing files are replaced. Publishing is not automatic.`;

export function scaffold(args, cwd = process.cwd()) {
  if (args.includes("--help") || args.includes("-h")) {
    return { help: HELP };
  }
  const unknown = args.filter((arg) => arg.startsWith("-") && arg !== "--install");
  if (unknown.length) throw new Error("Unknown argument: " + unknown[0]);
  const names = args.filter((arg) => arg !== "--install");
  if (names.length !== 1 || !/^[a-z][a-z0-9._-]*$/.test(names[0]) || names[0].includes("..")) {
    throw new Error("Provide one project name (lowercase letters, numbers, dots, hyphens, underscores).");
  }
  const name = names[0];
  const target = resolve(cwd, name);
  if (existsSync(target)) throw new Error("Target already exists: " + target);
  const template = resolve(dirname(fileURLToPath(import.meta.url)), "../template");
  const temp = mkdtempSync(join(cwd, ".folio-init-"));
  try {
    cpSync(template, temp, { recursive: true, force: true });
    // npm pack omits dot-gitignore files, so ship a named template and
    // materialize the real ignore file during scaffolding.
    renameSync(join(temp, "gitignore.template"), join(temp, ".gitignore"));
    const packagePath = join(temp, "package.json");
    const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
    pkg.name = name;
    writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");
    renameSync(temp, target);
  } catch (error) {
    rmSync(temp, { recursive: true, force: true });
    throw error;
  }

  if (args.includes("--install")) {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const result = spawnSync(npm, ["install", "--no-audit", "--no-fund"], { cwd: target, stdio: "inherit" });
    if (result.error || result.status !== 0) {
      throw new Error("Created " + target + ", but npm install failed. Run npm install in that directory.");
    }
  }
  return { target, installed: args.includes("--install") };
}

// npm exec/npx launches `bin` through node_modules/.bin symlinks.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const result = scaffold(process.argv.slice(2));
    if (result.help) console.log(result.help);
    else {
      console.log("\nFolio site created: " + result.target);
      console.log("\nNext steps:");
      console.log("  cd " + JSON.stringify(result.target));
      if (!result.installed) console.log("  npm install");
      console.log("  npm run dev");
      console.log("\nBuild and verify: npm run build");
    }
  } catch (error) {
    console.error("create-folio:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
