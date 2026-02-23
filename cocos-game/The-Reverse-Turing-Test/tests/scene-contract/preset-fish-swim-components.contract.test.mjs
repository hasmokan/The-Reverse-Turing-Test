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

test('PresetFishSwimSpawner is background-only and does not use GameManager items', () => {
  const source = readSource('assets/scripts/game/PresetFishSwimSpawner.ts');

  assert.match(source, /@ccclass\('PresetFishSwimSpawner'\)/);
  assert.match(source, /PRESET_FISH_BASE64/);
  assert.match(source, /FishSwinContainer/);
  assert.doesNotMatch(source, /GameManager\.instance\.addItem/);
  assert.match(source, /loadWithImageFactory/);
  assert.match(source, /setTimeout\(/);
  assert.match(source, /MultiPlayerScene/);
  assert.match(source, /createFallbackSwimContainer/);
  assert.match(source, /director\.getScene\(\)/);
  assert.match(source, /activeInHierarchy/);
  assert.match(source, /image\.crossOrigin = 'anonymous'/);
  assert.match(source, /private isDataUrl/);
});

test('BackgroundFishSwimmer clamps movement inside container bounds', () => {
  const source = readSource('assets/scripts/game/BackgroundFishSwimmer.ts');

  assert.match(source, /@ccclass\('BackgroundFishSwimmer'\)/);
  assert.match(source, /UITransform/);
  assert.match(source, /Vec3\.subtract\(new Vec3\(\)/);
  assert.match(source, /Math\.max\(/);
  assert.match(source, /Math\.min\(/);
});

test('GameStage wires preset fish spawner for multiplayer stage startup', () => {
  const source = readSource('assets/scripts/game/GameStage.ts');

  assert.match(source, /PresetFishSwimSpawner/);
  assert.match(source, /addComponent\(PresetFishSwimSpawner\)/);
});

test('GameStage can still spawn fish when fishPrefab is not configured', () => {
  const source = readSource('assets/scripts/game/GameStage.ts');

  assert.match(source, /createFallbackFishNode/);
  assert.match(source, /if \(!this\.fishPrefab\) \{/);
  assert.match(source, /fishNode = this\.createFallbackFishNode\(item\)/);
});

test('Main listens scene launch to ensure preset fish spawner in multiplayer scene', () => {
  const source = readSource('assets/scripts/Main.ts');

  assert.match(source, /EVENT_AFTER_SCENE_LAUNCH/);
  assert.match(source, /PresetFishSwimSpawner/);
  assert.match(source, /MultiPlayerScene/);
});

test('GameManager also ensures preset fish spawner after multiplayer scene launch', () => {
  const source = readSource('assets/scripts/core/GameManager.ts');

  assert.match(source, /EVENT_AFTER_SCENE_LAUNCH/);
  assert.match(source, /PresetFishSwimSpawner/);
  assert.match(source, /MultiPlayerScene/);
  assert.match(source, /addComponent\(PresetFishSwimSpawner\)/);
});
