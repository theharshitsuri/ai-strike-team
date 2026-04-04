import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.resolve(__dirname, '../../config');

const configCache = new Map();

/**
 * Recursively replace ${ENV_VAR} placeholders in any string values
 * with the matching process.env variable (or the placeholder itself
 * if the var is not set, so nothing silently becomes "undefined").
 */
function interpolateEnv(value) {
  if (typeof value === 'string') {
    return value.replace(/\$\{([^}]+)\}/g, (_, key) => process.env[key] ?? `\${${key}}`);
  }
  if (Array.isArray(value)) return value.map(interpolateEnv);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, interpolateEnv(v)]));
  }
  return value;
}

export function loadConfig(clientId) {
  if (configCache.has(clientId)) return configCache.get(clientId);

  const filePath = path.join(configDir, `${clientId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Client config not found: ${clientId}`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const config = interpolateEnv(JSON.parse(raw));
  configCache.set(clientId, config);
  return config;
}

export function saveConfig(clientId, configData) {
  const filePath = path.join(configDir, `${clientId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(configData, null, 2), 'utf-8');
  configCache.delete(clientId);
}

export function getAllConfigs() {
  const files = fs.readdirSync(configDir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const clientId = f.replace('.json', '');
    return loadConfig(clientId);
  });
}

export function clearConfigCache(clientId) {
  if (clientId) configCache.delete(clientId);
  else configCache.clear();
}
