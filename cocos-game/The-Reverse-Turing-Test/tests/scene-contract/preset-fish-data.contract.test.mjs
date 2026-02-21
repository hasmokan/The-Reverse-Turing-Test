import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readSource(relativePath) {
  return fs.readFileSync(path.resolve(PROJECT_ROOT, relativePath), 'utf8');
}

test('preset fish data module exports 3 remote fish entries', () => {
  const source = readSource('assets/scripts/data/PresetFishBase64.ts');

  assert.match(source, /export const PRESET_FISH_BASE64[\s\S]*=\s*\[/);
  assert.match(source, /id:\s*['"]fish_0['"]/);
  assert.match(source, /id:\s*['"]fish_1['"]/);
  assert.match(source, /id:\s*['"]fish_2['"]/);
  assert.match(source, /https:\/\/turing-test-1319469298\.cos\.ap-guangzhou\.myqcloud\.com\/fish_0\.png\?imageSlim/);
  assert.match(source, /https:\/\/turing-test-1319469298\.cos\.ap-guangzhou\.myqcloud\.com\/fish_1\.png\?imageSlim/);
  assert.match(source, /https:\/\/turing-test-1319469298\.cos\.ap-guangzhou\.myqcloud\.com\/fish_2\.png\?imageSlim/);

  const idMatches = source.match(/id:\s*['"]fish_[0-2]['"]/g) || [];
  assert.equal(idMatches.length, 3, 'must include exactly 3 preset fish entries');
});
