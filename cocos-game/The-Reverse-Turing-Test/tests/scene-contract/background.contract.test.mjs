import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readScene, findNodeByName, findComponentByPredicate } from "./sceneJson.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");

test("MultiPlayer background adaptation component exposes fit controls", () => {
  const scene = readScene("assets/scenes/MultiPlayerScene.scene");
  const background = findNodeByName(scene, "9_16_hand-drawn_grid_canvas 2");
  assert.ok(background);

  const bgComponent = findComponentByPredicate(
    scene,
    background,
    (comp) => typeof comp.fitMode === "number" && "autoFitScreen" in comp && "designWidth" in comp
  );

  assert.ok(bgComponent, "Background adaptation component should exist");
  assert.equal(typeof bgComponent.fitMode, "number");
  assert.equal(bgComponent.autoFitScreen, true);
});

test("GameBootstrap contains remote-image apply path", () => {
  const source = fs.readFileSync(
    path.resolve(PROJECT_ROOT, "assets/scripts/core/GameBootstrap.ts"),
    "utf8"
  );

  assert.match(source, /applyRemoteImages\(\)/);
  assert.match(source, /sprite\.spriteFrame\s*=\s*spriteFrame/);
});
