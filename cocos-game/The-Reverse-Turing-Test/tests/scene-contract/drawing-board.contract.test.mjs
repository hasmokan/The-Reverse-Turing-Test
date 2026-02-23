import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("drawing board action buttons use scene static placeholders for editor tuning", () => {
  const scene = readScene("assets/scenes/MultiPlayerScene.scene");
  const drawingPhaseUI = findNodeByName(scene, "DrawingPhaseUI");
  assert.ok(drawingPhaseUI, "DrawingPhaseUI node must exist");
  const drawingPhaseUIId = scene.indexOf(drawingPhaseUI);

  const findNodeByNameInScene = (name) => scene.find((obj) => obj?.__type__ === "cc.Node" && obj?._name === name);
  const isInDrawingPhaseTree = (node) => {
    let current = node;
    while (current && current._parent && Number.isInteger(current._parent.__id__)) {
      const parentNode = scene[current._parent.__id__];
      if (!parentNode || parentNode.__type__ !== "cc.Node") {
        break;
      }
      if (scene.indexOf(parentNode) === drawingPhaseUIId) {
        return true;
      }
      current = parentNode;
    }
    return false;
  };

  const drawButtonNode = findNodeByNameInScene("DrawModeButton");
  const eraserButtonNode = findNodeByNameInScene("EraserModeButton");
  const submitButtonNode = findNodeByNameInScene("SubmitButton");

  assert.ok(drawButtonNode, "DrawModeButton must be a static scene node");
  assert.ok(eraserButtonNode, "EraserModeButton must be a static scene node");
  assert.ok(submitButtonNode, "SubmitButton must be a static scene node");
  assert.equal(isInDrawingPhaseTree(drawButtonNode), true, "DrawModeButton must be under DrawingPhaseUI");
  assert.equal(isInDrawingPhaseTree(eraserButtonNode), true, "EraserModeButton must be under DrawingPhaseUI");
  assert.equal(isInDrawingPhaseTree(submitButtonNode), true, "SubmitButton must be under DrawingPhaseUI");

  const drawingBoard = findNodeByName(scene, "DrawingBoard");
  assert.ok(drawingBoard, "DrawingBoard node must exist");

  const drawingBoardCompId = (drawingBoard._components ?? [])
    .map((ref) => ref?.__id__)
    .find((id) => {
      const comp = scene[id];
      return comp && comp.drawingCanvas && "submitButton" in comp;
    });
  assert.ok(Number.isInteger(drawingBoardCompId), "DrawingBoard component must exist");

  const drawingBoardComp = scene[drawingBoardCompId];
  assert.ok(drawingBoardComp.drawModeButton, "DrawingBoard component must bind drawModeButton");
  assert.ok(drawingBoardComp.eraserModeButton, "DrawingBoard component must bind eraserModeButton");
  assert.ok(drawingBoardComp.submitButton, "DrawingBoard component must bind submitButton");

  const getSize = (node) => {
    const uiCompId = (node?._components ?? [])
      .map((ref) => ref?.__id__)
      .find((id) => scene[id]?.__type__ === "cc.UITransform");
    return scene[uiCompId]?._contentSize;
  };

  const drawSize = getSize(drawButtonNode);
  const eraserSize = getSize(eraserButtonNode);
  const submitSize = getSize(submitButtonNode);

  assert.ok(drawSize && drawSize.width > 0 && drawSize.height > 0, "DrawModeButton must have valid size");
  assert.ok(eraserSize && eraserSize.width > 0 && eraserSize.height > 0, "EraserModeButton must have valid size");
  assert.ok(submitSize && submitSize.width > 0 && submitSize.height > 0, "SubmitButton must have valid size");
});

test("drawing board listens touch events on drawingCanvas instead of 1x1 host node", () => {
  const source = readFileSync(new URL("../../assets/scripts/ui/multiplayer/DrawingBoard.ts", import.meta.url), "utf8");

  assert.match(source, /this\.drawingCanvas\.on\(Input\.EventType\.TOUCH_START/);
  assert.match(source, /this\.drawingCanvas\.on\(Input\.EventType\.TOUCH_MOVE/);
  assert.match(source, /this\.drawingCanvas\.on\(Input\.EventType\.TOUCH_END/);
  assert.match(source, /this\.drawingCanvas\.on\(Input\.EventType\.TOUCH_CANCEL/);

  assert.doesNotMatch(source, /this\.node\.on\(Input\.EventType\.TOUCH_START/);
  assert.doesNotMatch(source, /this\.node\.on\(Input\.EventType\.TOUCH_MOVE/);
  assert.doesNotMatch(source, /this\.node\.on\(Input\.EventType\.TOUCH_END/);
  assert.doesNotMatch(source, /this\.node\.on\(Input\.EventType\.TOUCH_CANCEL/);
});

test("drawing board limits brush colors to frontend palette", () => {
  const source = readFileSync(new URL("../../assets/scripts/ui/multiplayer/DrawingBoard.ts", import.meta.url), "utf8");

  assert.match(source, /FRONTEND_BRUSH_COLOR_HEXES/);
  assert.match(source, /#000000/);
  assert.match(source, /#FF2A2A/);
  assert.match(source, /#1F75FE/);
  assert.match(source, /#00CC44/);
  assert.match(source, /#FF9900/);
  assert.match(source, /setBrushColorByHex/);
});

test("drawing board uses required toolbar icon urls and bottom layout constants", () => {
  const source = readFileSync(new URL("../../assets/scripts/ui/multiplayer/DrawingBoard.ts", import.meta.url), "utf8");

  assert.match(source, /draw\.png\?imageSlim/);
  assert.match(source, /eraser\.png\?imageSlim/);
  assert.match(source, /save\.png\?imageSlim/);

  assert.match(source, /ACTION_BUTTON_SIZE = 40/);
  assert.match(source, /ACTION_BUTTON_SPACING = 20/);
  assert.match(source, /ensureToolbarNode\('DrawActionToolbar',\s*24\)/);
  assert.match(source, /widget\.isAlignBottom = true/);
  assert.match(source, /widget\.isAlignHorizontalCenter = true/);
});

test("drawing board submit flow emits commit token for dedupe", () => {
  const source = readFileSync(new URL("../../assets/scripts/ui/multiplayer/DrawingBoard.ts", import.meta.url), "utf8");

  assert.match(source, /commitToken = `\$\{Date\.now\(\)\}-\$\{Math\.random\(\)\.toString\(36\)\.slice\(2,\s*10\)\}`/);
  assert.match(source, /this\.node\.emit\('drawing-completed',\s*spriteFrame,\s*commitToken\)/);
  assert.match(source, /if\s*\(this\.isSubmitting\)/);
});
