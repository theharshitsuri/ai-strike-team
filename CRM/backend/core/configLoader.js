import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.resolve(__dirname, '../../config');

const configCache = new Map();

export function loadConfig(clientId) {
  if (configCache.has(clientId)) return configCache.get(clientId);

  const filePath = path.join(configDir, `${clientId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Client config not found: ${clientId}`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const config = JSON.parse(raw);
  configCache.set(clientId, config);
  return config;
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
