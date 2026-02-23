import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readScene } from "./sceneJson.mjs";

function getExistingSceneNames() {
  return new Set(["MainScene", "MultiPlayerScene"]);
}

function resolveNodeRef(scene, ref) {
  if (!ref || typeof ref.__id__ !== "number") {
    return null;
  }
  const target = scene[ref.__id__];
  if (!target) {
    return null;
  }

  if (target.__type__ === "cc.Node") {
    return target;
  }

  if (target.__type__ === "cc.Button") {
    return resolveNodeRef(scene, target.node);
  }

  return null;
}

test("MainScene scene switch targets exist in project scenes", () => {
  const scene = readScene("assets/scenes/MainScene.scene");
  const existingScenes = getExistingSceneNames();

  const missingTargets = scene
    .filter((item) => typeof item?.targetScene === "string" && item.targetScene.length > 0)
    .map((item) => item.targetScene)
    .filter((target) => !existingScenes.has(target));

  assert.deepEqual(missingTargets, []);
});

test("multiplayer controller script file is renamed from SinglePlayerController", () => {
  assert.equal(fs.existsSync("assets/scripts/game/MultiPlayerController.ts"), true);
  assert.equal(fs.existsSync("assets/scripts/game/MultiPlayerController.ts.meta"), true);
  assert.equal(fs.existsSync("assets/scripts/game/SinglePlayerController.ts"), false);
  assert.equal(fs.existsSync("assets/scripts/game/SinglePlayerController.ts.meta"), false);
});

test("MultiPlayerController startGameButton reference is either unset or points to a node", () => {
  const scene = readScene("assets/scenes/MultiPlayerScene.scene");
  const controllerNode = scene.find(
    (item) => item && item.__type__ === "cc.Node" && item._name === "MultiPlayerController",
  );

  assert.ok(controllerNode, "MultiPlayerController node should exist in MultiPlayerScene");
  const controllerNodeId = scene.indexOf(controllerNode);
  const controller = scene.find(
    (item) =>
      item &&
      typeof item === "object" &&
      item.node &&
      item.node.__id__ === controllerNodeId &&
      "startGameButton" in item &&
      "drawMoreButton" in item &&
      "drawingBoardNode" in item,
  );

  assert.ok(controller, "MultiPlayerController component should exist in MultiPlayerScene");

  const buttonRef = controller.startGameButton;
  if (!buttonRef) {
    assert.equal(buttonRef, null);
    return;
  }

  const buttonNode = resolveNodeRef(scene, buttonRef);
  assert.ok(buttonNode, "startGameButton should resolve to a valid cc.Node");
});

test("MultiPlayerController onDestroy uses safe unbind helper for node events", () => {
  const source = fs.readFileSync("assets/scripts/game/MultiPlayerController.ts", "utf-8");

  assert.match(source, /private safeNodeOff\(/);
  assert.match(source, /this\.safeNodeOff\(this\.drawingBoardNode,\s*'drawing-completed'/);
  assert.doesNotMatch(source, /this\.drawingBoardNode\.off\('drawing-completed'/);
});

test("MultiPlayerController onDestroy guards drawingPhaseUI before querying children", () => {
  const source = fs.readFileSync("assets/scripts/game/MultiPlayerController.ts", "utf-8");

  assert.match(source, /if\s*\(\s*drawingPhaseUiNode\s*&&\s*drawingPhaseUiNode\.isValid\s*\)/);
  assert.match(source, /drawingPhaseUiNode\.getChildByName\('QuickFillButton'\)/);
  assert.match(source, /drawingPhaseUiNode\.getChildByName\('SkipMetaButton'\)/);
});
