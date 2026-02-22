import test from "node:test";
import assert from "node:assert/strict";
import { findNodeByName, readScene } from "./sceneJson.mjs";

test("drawing board keeps background under draw canvas", () => {
  const scene = readScene("assets/scenes/MultiPlayerScene.scene");
  const drawingBoard = findNodeByName(scene, "DrawingBoard");
  assert.ok(drawingBoard, "DrawingBoard node must exist");

  const childIds = (drawingBoard._children ?? []).map((ref) => ref?.__id__).filter((id) => Number.isInteger(id));
  const childNames = childIds.map((id) => scene[id]?._name);

  const drawBgIndex = childNames.indexOf("drawBg");
  const drawCanvasIndex = childNames.indexOf("DrawCanvas");

  assert.notEqual(drawBgIndex, -1, "drawBg child must exist");
  assert.notEqual(drawCanvasIndex, -1, "DrawCanvas child must exist");
  assert.ok(
    drawBgIndex < drawCanvasIndex,
    `drawBg must be below DrawCanvas. current order: ${childNames.join(" -> ")}`
  );

  const drawCanvas = scene[childIds[drawCanvasIndex]];
  const drawCanvasComponentTypes = (drawCanvas?._components ?? [])
    .map((ref) => scene[ref.__id__]?.__type__)
    .filter(Boolean);
  assert.ok(drawCanvasComponentTypes.includes("cc.Graphics"), "DrawCanvas must include cc.Graphics");
});

