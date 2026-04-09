/**
 * .env から env.yaml を自動生成するスクリプト
 * Usage: node scripts/generate-env-yaml.js
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const yamlPath = path.join(__dirname, '..', 'env.yaml');

if (!fs.existsSync(envPath)) {
  console.error('.env ファイルが見つかりません');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const lines = envContent.split('\n');
const yamlLines = [];

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex === -1) continue;
  const key = trimmed.substring(0, eqIndex);
  const value = trimmed.substring(eqIndex + 1);
  yamlLines.push(`${key}: "${value}"`);
}

fs.writeFileSync(yamlPath, yamlLines.join('\n') + '\n');
console.log(`env.yaml を生成しました (${yamlLines.length}項目)`);
