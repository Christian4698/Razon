import fs from "fs";
import path from "path";

const loadedEnvFiles = new Set<string>();

function stripQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseEnvLine(line: string) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) return null;

  const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
  const separatorIndex = normalized.indexOf("=");

  if (separatorIndex <= 0) return null;

  const key = normalized.slice(0, separatorIndex).trim();
  const value = stripQuotes(normalized.slice(separatorIndex + 1));

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  return { key, value };
}

export function loadServerEnv(envPath = path.resolve(process.cwd(), ".env")) {
  const resolvedPath = path.resolve(envPath);

  if (loadedEnvFiles.has(resolvedPath)) return;
  loadedEnvFiles.add(resolvedPath);

  if (!fs.existsSync(resolvedPath)) {
    console.info("[RAZON env] .env loaded=false");
    return;
  }

  const content = fs.readFileSync(resolvedPath, "utf8");
  let loadedCount = 0;

  for (const line of content.split(/\r?\n/)) {
    const entry = parseEnvLine(line);

    if (!entry || process.env[entry.key] !== undefined) continue;

    process.env[entry.key] = entry.value;
    loadedCount += 1;
  }

  console.info(`[RAZON env] .env loaded=true keys=${loadedCount}`);
}
