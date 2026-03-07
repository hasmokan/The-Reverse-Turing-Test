import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("ResourceLoader exposes unified node mapping apply method", () => {
  const source = readFileSync(new URL("../../assets/scripts/core/ResourceLoader.ts", import.meta.url), "utf8");

  assert.match(source, /public applyMappedSpriteFrames\(root: Node\)/);
  assert.match(source, /ResourceConfig\.NODE_MAPPING/);
  assert.match(source, /buildSpriteFrameWithTemplateGeometry\(/);
  assert.match(source, /buildSpriteFrameWithTemplateGeometry\(spriteFrame,\s*templateFrame,\s*key,\s*nodeName\)\s*\|\|\s*spriteFrame/);
  assert.match(source, /sprite\.spriteFrame = finalFrame/);
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

test("ResourceLoader includes geometry compatibility fallback when composing sprite frames", () => {
  const source = readFileSync(new URL("../../assets/scripts/core/ResourceLoader.ts", import.meta.url), "utf8");

  assert.match(source, /private isTemplateGeometryCompatible\(/);
  assert.match(source, /纹理尺寸与模板几何不兼容，回退直贴/);
  assert.match(source, /return null;\s*\n\s*\}\n\s*\n\s*const composed = new SpriteFrame\(\)/);
});

test("ResourceConfig maps back button resource to BackButton node", () => {
  const source = readFileSync(new URL("../../assets/scripts/core/ResourceConfig.ts", import.meta.url), "utf8");

  assert.match(source, /'back_btn':\s*'BackButton'/);
});
