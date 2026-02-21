import test from "node:test";
import assert from "node:assert/strict";
import {
  readScene,
  findNodeByName,
  getNodeComponents,
  findComponentByPredicate,
} from "./sceneJson.mjs";

function assertCanvasExists(scene, sceneName) {
  const canvas = findNodeByName(scene, "Canvas");
  assert.ok(canvas, `${sceneName} must contain Canvas node`);
  const canvasComps = getNodeComponents(scene, canvas);
  assert.ok(
    canvasComps.some((comp) => comp.__type__ === "cc.Canvas"),
    `${sceneName} Canvas must include cc.Canvas component`
  );
}

test("MainScene has baseline adaptation structure", () => {
  const scene = readScene("assets/scenes/MainScene.scene");
  assertCanvasExists(scene, "MainScene");

  const background = findNodeByName(scene, "Background");
  assert.ok(background, "MainScene must contain Background node");
  assert.ok(
    getNodeComponents(scene, background).some((comp) => comp.__type__ === "cc.Sprite"),
    "MainScene Background should include Sprite"
  );

  const gameStage = findNodeByName(scene, "GameStage");
  assert.ok(gameStage, "MainScene must contain GameStage node");
});

test("MultiPlayerScene has baseline adaptation structure", () => {
  const scene = readScene("assets/scenes/MultiPlayerScene.scene");
  assertCanvasExists(scene, "MultiPlayerScene");

  const background = findNodeByName(scene, "9_16_hand-drawn_grid_canvas 2");
  assert.ok(background, "MultiPlayerScene must contain background node");

  const bgComponent = findComponentByPredicate(
    scene,
    background,
    (comp) => typeof comp.fitMode === "number" && "autoFitScreen" in comp && "backgroundImage" in comp
  );
  assert.ok(bgComponent, "MultiPlayer background should contain adaptation component");

  const backButton = findNodeByName(scene, "BackButton");
  assert.ok(backButton, "MultiPlayerScene must contain BackButton node");

  const drawingPhase = findNodeByName(scene, "DrawingPhaseUI");
  assert.ok(drawingPhase, "MultiPlayerScene must contain DrawingPhaseUI node");
});
