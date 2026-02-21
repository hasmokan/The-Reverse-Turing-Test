import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");

export function readJson(relativePath) {
  const fullPath = path.resolve(PROJECT_ROOT, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

export function readScene(relativePath) {
  return readJson(relativePath);
}

export function findNodeByName(scene, name) {
  return scene.find((item) => item?.__type__ === "cc.Node" && item._name === name) ?? null;
}

export function findAllNodesByName(scene, name) {
  return scene.filter((item) => item?.__type__ === "cc.Node" && item._name === name);
}

export function getNodeComponents(scene, node) {
  const refs = node?._components ?? [];
  return refs
    .map((ref) => scene[ref.__id__])
    .filter(Boolean);
}

export function findComponentByPredicate(scene, node, predicate) {
  return getNodeComponents(scene, node).find(predicate) ?? null;
}

export function hasSceneComponent(scene, typeName) {
  return scene.some((item) => item?.__type__ === typeName);
}
