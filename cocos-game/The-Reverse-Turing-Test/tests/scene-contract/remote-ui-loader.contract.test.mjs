import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("ResourceLoader exposes unified node mapping apply method", () => {
  const source = readFileSync(new URL("../../assets/scripts/core/ResourceLoader.ts", import.meta.url), "utf8");

  assert.match(source, /public applyMappedSpriteFrames\(root: Node\)/);
  assert.match(source, /ResourceConfig\.NODE_MAPPING/);
  assert.match(source, /sprite\.spriteFrame = spriteFrame/);
});

test("GameManager re-applies remote UI mapping after scene launch", () => {
  const source = readFileSync(new URL("../../assets/scripts/core/GameManager.ts", import.meta.url), "utf8");

  assert.match(source, /private ensureResourceLoader\(\): ResourceLoader \| null/);
  assert.match(source, /private async syncRemoteUiForCurrentScene\(\): Promise<void>/);
  assert.match(source, /void this\.syncRemoteUiForCurrentScene\(\)/);
});

test("GameBootstrap delegates remote image application to ResourceLoader mapping API", () => {
  const source = readFileSync(new URL("../../assets/scripts/core/GameBootstrap.ts", import.meta.url), "utf8");

  assert.match(source, /applyMappedSpriteFrames\(canvas\)/);
});

test("MenuButtonHandler binds clicks only on valid button nodes", () => {
  const source = readFileSync(new URL("../../assets/scripts/ui/main-menu/MenuButtonHandler.ts", import.meta.url), "utf8");

  assert.match(source, /private resolveButtonNode\(button: Button \| null\): Node \| null/);
  assert.match(source, /button\.isValid/);
  assert.match(source, /node && node\.isValid \? node : null/);
  assert.match(source, /private bindButtonClick\(/);
});

test("ResourceLoader protects async cache mutations after destroy", () => {
  const source = readFileSync(new URL("../../assets/scripts/core/ResourceLoader.ts", import.meta.url), "utf8");

  assert.match(source, /private _disposed = false/);
  assert.match(source, /private ensureRuntimeState\(\): boolean/);
  assert.match(source, /if \(!this\.ensureRuntimeState\(\)\) \{\s*return null;\s*\}/);
  assert.match(source, /if \(!this\._disposed && this\.isValid && this\._cache\) \{/);
  assert.match(source, /if \(!this\._disposed && this\.isValid && this\._loading\) \{/);
});
