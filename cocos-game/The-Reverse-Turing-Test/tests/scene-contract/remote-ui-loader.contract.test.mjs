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
