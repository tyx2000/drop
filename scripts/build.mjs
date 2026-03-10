#!/usr/bin/env node

import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants as zlibConstants, gzipSync } from "node:zlib";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");
const tsupBin = require.resolve("tsup/dist/cli-default.js");
const tsupConfig = path.join(rootDir, "tsup.config.ts");

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} kB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}

function padRow(values, widths) {
  return values
    .map((value, index) => value.toString().padStart(widths[index], " "))
    .join("  ");
}

async function runTsup(label, env, inheritOutput = false) {
  console.log(`${label}...`);

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tsupBin, "--config", tsupConfig], {
      cwd: rootDir,
      env: {
        ...process.env,
        ...env
      },
      stdio: inheritOutput ? "inherit" : "pipe"
    });

    let output = "";

    if (!inheritOutput) {
      child.stdout.on("data", (chunk) => {
        output += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        output += chunk.toString();
      });
    }

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      if (output) {
        process.stderr.write(output);
      }

      reject(new Error(`${label} failed with exit code ${code ?? "unknown"}.`));
    });
  });
}

async function getBundleFiles(directory) {
  const entries = await readdir(directory);
  return entries
    .filter((file) => (file.endsWith(".js") || file.endsWith(".mjs")) && !file.endsWith(".map"))
    .sort();
}

async function readCompressedSizes(filePath) {
  const source = await readFile(filePath);
  return {
    raw: source.byteLength,
    gzip: gzipSync(source).byteLength,
    brotli: brotliCompressSync(source, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 11
      }
    }).byteLength
  };
}

async function createReportRows(baselineDir, outputDir) {
  const files = await getBundleFiles(outputDir);
  const rows = [];
  const totals = {
    before: 0,
    after: 0,
    gzip: 0,
    brotli: 0
  };

  for (const file of files) {
    const baselinePath = path.join(baselineDir, file);
    const outputPath = path.join(outputDir, file);

    await stat(baselinePath);

    const before = await readCompressedSizes(baselinePath);
    const after = await readCompressedSizes(outputPath);
    const saved = before.raw - after.raw;
    const ratio = before.raw === 0 ? 0 : (saved / before.raw) * 100;

    totals.before += before.raw;
    totals.after += after.raw;
    totals.gzip += after.gzip;
    totals.brotli += after.brotli;

    rows.push({
      file,
      before: formatBytes(before.raw),
      after: formatBytes(after.raw),
      gzip: formatBytes(after.gzip),
      brotli: formatBytes(after.brotli),
      saved: formatBytes(saved),
      ratio: formatPercent(ratio)
    });
  }

  const totalSaved = totals.before - totals.after;
  rows.push({
    file: "Total",
    before: formatBytes(totals.before),
    after: formatBytes(totals.after),
    gzip: formatBytes(totals.gzip),
    brotli: formatBytes(totals.brotli),
    saved: formatBytes(totalSaved),
    ratio: formatPercent(totals.before === 0 ? 0 : (totalSaved / totals.before) * 100)
  });

  return rows;
}

function printReport(rows) {
  const headers = ["File", "Before", "After", "Gzip", "Brotli", "Saved", "Ratio"];
  const values = rows.map((row) => [
    row.file,
    row.before,
    row.after,
    row.gzip,
    row.brotli,
    row.saved,
    row.ratio
  ]);
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...values.map((row) => row[index].length))
  );

  const divider = widths.map((width) => "-".repeat(width)).join("  ");
  const lines = [
    headers.map((header, index) => header.padStart(widths[index], " ")).join("  "),
    divider,
    ...values.map((row) => padRow(row, widths))
  ];

  console.log("\nBundle Size Report");
  console.log(lines.join("\n"));
}

async function main() {
  const baselineDir = await mkdtemp(path.join(tmpdir(), "react-drag-size-"));

  try {
    await runTsup("Building baseline bundle", {
      BUILD_OUT_DIR: baselineDir,
      BUILD_MINIFY: "false",
      BUILD_DTS: "false",
      BUILD_CLEAN: "true"
    });

    await runTsup("Building minified bundle", {
      BUILD_OUT_DIR: distDir,
      BUILD_MINIFY: "true",
      BUILD_DTS: "true",
      BUILD_CLEAN: "true"
    }, true);

    const rows = await createReportRows(baselineDir, distDir);
    printReport(rows);
  } finally {
    await rm(baselineDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
