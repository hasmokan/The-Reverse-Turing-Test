import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readScene, findNodeByName, findComponentByPredicate } from "./sceneJson.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");

test("MultiPlayer background fit mode is width-priority stretch-height", () => {
  const scene = readScene("assets/scenes/MultiPlayerScene.scene");
  const background = findNodeByName(scene, "9_16_hand-drawn_grid_canvas 2");
  assert.ok(background);

  const bgComponent = findComponentByPredicate(
    scene,
    background,
    (comp) => typeof comp.fitMode === "number" && "autoFitScreen" in comp && "designWidth" in comp
  );

  assert.ok(bgComponent, "Background adaptation component should exist");
  assert.equal(bgComponent.fitMode, 3);
});

test("BackgroundManager defaults to width-priority mode", () => {
  const source = fs.readFileSync(
    path.resolve(PROJECT_ROOT, "assets/scripts/ui/common/BackgroundManager.ts"),
    "utf8"
  );

  assert.match(source, /WIDTH_PRIORITY_STRETCH_HEIGHT/);
  assert.match(source, /fitMode:\s*FitMode\s*=\s*FitMode\.WIDTH_PRIORITY_STRETCH_HEIGHT/);
});

test("ResourceLoader applies remote background via BackgroundManager when available", () => {
  const source = fs.readFileSync(
    path.resolve(PROJECT_ROOT, "assets/scripts/core/ResourceLoader.ts"),
    "utf8"
  );

  assert.match(source, /getComponent\('BackgroundManager'\)/);
  assert.match(source, /changeBackground\(spriteFrame\)/);
});
