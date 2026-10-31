// T2/T3 contract verification: install the package's real .tgz tarball into a
// throwaway consumer and prove the three public entrypoints and their declared
// types resolve without any monorepo/workspace resolution. The same isolated
// installation also builds a minimal Vite + React application, which proves
// the Folio plugin discovers Markdown and that virtual:folio/content reaches a
// real client bundle, and then builds it once more with static generation on
// to prove the plugin writes the published static site (index.html, content
// page, 404.html, sitemap.xml, robots.txt).
//
// The acceptance evidence this produces is tied to one commit: it rebuilds
// dist, packs the tarball, records its sha256, and installs that exact file
// into a temporary directory outside the repository. One build, one pack and
// one dependency installation cover all consumer checks so CI pays for them
// only once.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyStaticConsumer } from "./checks/static-consumer.mjs";
import { verifyViteConsumer } from "./checks/vite-consumer.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, "..");
const repositoryRoot = resolve(packageRoot, "..", "..");
const fixtureDir = join(scriptDir, "fixtures", "tarball-consumer");
const keepTempDir = process.argv.includes("--keep");
const registryMode = process.argv.includes("--registry");
const registryUrl = "https://registry.npmjs.org/";

const isWindows = process.platform === "win32";

const packageManifest = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8"),
);
const packageSpec = `${packageManifest.name}@${packageManifest.version}`;

function npmCli() {
  const candidate = join(
    dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js",
  );
  return existsSync(candidate) ? candidate : undefined;
}

function typescriptCli() {
  const require = createRequire(join(packageRoot, "package.json"));
  const manifestPath = require.resolve("typescript/package.json");
  return join(dirname(manifestPath), "bin", "tsc");
}

function runNpm(args, cwd) {
  const npm = npmCli();
  const command = npm ? process.execPath : isWindows ? "npm.cmd" : "npm";
  const commandArgs = npm ? [npm, ...args] : args;
  return spawnSync(command, commandArgs, {
    cwd,
    encoding: "utf8",
    shell: !npm && isWindows,
    timeout: 600_000,
    env: {
      ...process.env,
      npm_config_audit: "false",
      npm_config_fund: "false",
      npm_config_update_notifier: "false",
    },
  });
}

function assertStep(label, result) {
  if (result.error) {
    throw new Error(`${label} could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `${label} failed with exit code ${result.status}\n` +
        `--- stdout ---\n${(result.stdout ?? "").trim()}\n` +
        `--- stderr ---\n${(result.stderr ?? "").trim()}`,
    );
  }
  return result;
}

function log(line) {
  console.log(line);
}

function git(args) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    timeout: 60_000,
  });
  return result.status === 0 ? (result.stdout ?? "").trim() : undefined;
}

const commit = git(["rev-parse", "HEAD"]);
const dirty = Boolean(git(["status", "--porcelain"]));
const tarballSource = commit
  ? `${commit}${dirty ? " (working tree dirty)" : ""}`
  : "unknown commit";

// Windows runners can expose the same TEMP parent as RUNNER~1 (short path)
// while Vite resolves the consumer as runneradmin (long path). Canonicalize
// once so HTML assets and Vite outDir share an identical filesystem root.
const tempRoot = realpathSync.native(mkdtempSync(join(tmpdir(), registryMode ? "folio-registry-consumer-" : "folio-tarball-consumer-")));
const tarballDir = join(tempRoot, "tarball");
const consumerDir = join(tempRoot, "consumer");
mkdirSync(tarballDir, { recursive: true });
cpSync(fixtureDir, consumerDir, { recursive: true });

let succeeded = false;

try {
  log(registryMode ? "Folio npm Registry consumer verification (T2/T3)" : "Folio tarball consumer verification (T2)");
  log(`  package:  ${packageManifest.name}@${packageManifest.version}`);
  log(`  source:   ${tarballSource}`);
  log(`  node:     ${process.version} (${process.platform}/${process.arch})`);
  log(`  consumer: ${consumerDir}`);
  log("");

  assertStep("npm run build", runNpm(["run", "build"], packageRoot));
  let installSpec;
  let registryMetadata;
  if (registryMode) {
    // The source checkout provides only the *test harness*; the Folio package
    // must be obtained by npm install from the actual public registry.
    const view = assertStep(
      "npm view Registry package",
      runNpm(["view", packageSpec, "--json", `--registry=${registryUrl}`], consumerDir),
    );
    registryMetadata = JSON.parse(view.stdout);
    assert.equal(registryMetadata.name, packageManifest.name);
    assert.equal(registryMetadata.version, packageManifest.version);
    assert.ok(registryMetadata.dist?.integrity, "[registry] missing dist.integrity");
    assert.ok(
      registryMetadata.dist?.tarball?.startsWith("https://registry.npmjs.org/"),
      "[registry] package dist.tarball is not from npm Registry",
    );
    log(`[registry] ok  ${packageSpec} ${registryMetadata.dist.integrity}`);
    installSpec = packageSpec;
  } else {
    assertStep(
      "npm pack",
      runNpm(
        ["pack", "--ignore-scripts", "--pack-destination", tarballDir, "--json"],
        packageRoot,
      ),
    );
    const tarballs = readdirSync(tarballDir).filter((file) => file.endsWith(".tgz"));
    assert.equal(tarballs.length, 1, `expected exactly one packed tarball, found ${tarballs.length}`);
    const tarballPath = join(tarballDir, tarballs[0]);
    const tarballSha256 = createHash("sha256")
      .update(readFileSync(tarballPath))
      .digest("hex");
    log(`[tarball]  ok  ${tarballs[0]} sha256=${tarballSha256}`);
    installSpec = tarballPath;
  }

  // Peer dependencies are intentionally not installed explicitly: npm must
  // bring them in from the package manifest, exactly as for a real consumer.
  assertStep(
    registryMode ? "npm install <registry package>" : "npm install <tarball>",
    runNpm(
      [
        "install",
        "--no-audit",
        "--no-fund",
        `--registry=${registryUrl}`,
        installSpec,
        "@vitejs/plugin-react@^5",
        "@types/node@^24",
        "@types/react@^19",
        "@types/react-dom@^19",
      ],
      consumerDir,
    ),
  );

  if (registryMode) {
    // A public Registry URL and SRI lock entry prove this did NOT silently
    // fall back to a workspace, local tarball or file: dependency.
    const lock = JSON.parse(readFileSync(join(consumerDir, "package-lock.json"), "utf8"));
    const installed = lock.packages?.[`node_modules/${packageManifest.name}`];
    assert.equal(installed?.version, packageManifest.version, "[registry] wrong installed version");
    assert.ok(
      installed?.resolved?.startsWith("https://registry.npmjs.org/"),
      `[registry] non-registry install: ${installed?.resolved}`,
    );
    assert.equal(installed.integrity, registryMetadata.dist.integrity, "[registry] SRI mismatch");
    log(`[registry] ok  lockfile resolved ${installed.resolved}; SRI matched npm view`);

    // Compare the published JavaScript, declarations and CSS to the
    // accepted source tree after building it using the locked toolchain.
    const installedDir = join(consumerDir, "node_modules", "@uichat-mira", "folio", "dist");
    for (const filename of ["index.js", "index.d.ts", "vite.js", "vite.d.ts", "virtual.d.ts", "styles.css"]) {
      const local = readFileSync(join(packageRoot, "dist", filename));
      const published = readFileSync(join(installedDir, filename));
      assert.deepEqual(published, local, `[registry] published dist/${filename} differs from accepted source`);
    }
    log("[registry] ok  published JS/types/CSS match the checked-out source build");
  }

  const entrypoints = assertStep(
    "entrypoint resolution",
    spawnSync(
      process.execPath,
      [
        "verify-entrypoints.mjs",
        "--expected-version",
        packageManifest.version,
        "--repo-root",
        repositoryRoot,
      ],
      { cwd: consumerDir, encoding: "utf8", timeout: 300_000 },
    ),
  );
  process.stdout.write(entrypoints.stdout ?? "");

  assertStep(
    "typescript declaration resolution",
    spawnSync(process.execPath, [typescriptCli(), "-p", "tsconfig.json"], {
      cwd: consumerDir,
      encoding: "utf8",
      timeout: 300_000,
    }),
  );
  log(`[types]    ok  tsc --noEmit (NodeNext, skipLibCheck=false) resolved the declarations`);

  const viteConsumer = verifyViteConsumer({
    consumerDir,
    fixtureDir: join(scriptDir, "fixtures", "vite-consumer"),
    typescriptCli: typescriptCli(),
    log,
  });

  verifyStaticConsumer({
    consumerDir,
    appDir: viteConsumer.appDir,
    log,
  });

  succeeded = true;
  log("");
  log(
    `${registryMode ? "Registry" : "Tarball"} consumer verification passed for ${packageSpec} (${tarballSource})`,
  );
} finally {
  if (keepTempDir || !succeeded) {
    log("");
    log(`Tarball consumer directory kept for diagnosis: ${tempRoot}`);
  } else {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}
