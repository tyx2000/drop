#!/usr/bin/env node

import { readFile } from "node:fs/promises";

async function readPackageJson() {
  const fileUrl = new URL("../package.json", import.meta.url);
  const raw = await readFile(fileUrl, "utf8");
  return JSON.parse(raw);
}

function toRegistryPackagePath(name) {
  return name.startsWith("@") ? name.replace("/", "%2f") : name;
}

function writeGithubOutput(values) {
  const outputPath = process.env.GITHUB_OUTPUT;

  if (!outputPath) {
    return;
  }

  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  return import("node:fs/promises").then(({ appendFile }) =>
    appendFile(outputPath, `${lines.join("\n")}\n`)
  );
}

async function main() {
  const pkg = await readPackageJson();
  const name = process.env.NPM_PACKAGE_NAME || pkg.name;
  const version = process.env.NPM_PACKAGE_VERSION || pkg.version;
  const registry =
    (process.env.NPM_REGISTRY_URL || "https://registry.npmjs.org").replace(/\/$/, "");
  const requireNameAvailable = process.env.REQUIRE_NAME_AVAILABLE === "true";
  const url = `${registry}/${toRegistryPackagePath(name)}`;

  const response = await fetch(url, {
    headers: {
      accept: "application/json"
    }
  });

  if (response.status === 404) {
    console.log(`npm package name "${name}" is available.`);
    await writeGithubOutput({
      package_name: name,
      package_version: version,
      package_exists: "false",
      package_name_available: "true",
      version_available: "true"
    });
    return;
  }

  if (!response.ok) {
    throw new Error(`Failed to query npm registry: ${response.status} ${response.statusText}`);
  }

  const metadata = await response.json();
  const versionExists = Boolean(metadata.versions?.[version]);

  console.log(`npm package "${name}" already exists.`);
  console.log(
    versionExists
      ? `Version ${version} is already published.`
      : `Version ${version} is not published yet.`
  );

  await writeGithubOutput({
    package_name: name,
    package_version: version,
    package_exists: "true",
    package_name_available: "false",
    version_available: String(!versionExists)
  });

  if (requireNameAvailable) {
    throw new Error(
      `Package name "${name}" is already taken on npm. Choose another package name before first publish.`
    );
  }

  if (versionExists) {
    throw new Error(`Version ${version} is already published for "${name}".`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
