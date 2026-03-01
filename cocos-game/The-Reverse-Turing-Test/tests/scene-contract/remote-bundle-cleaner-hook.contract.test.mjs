import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const hooks = require("../../extensions/remote-bundle-cleaner/dist/hooks.js");

function setupTempWechatBuild(engineAdapterContent) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rbc-hook-test-"));
  const scenesDir = path.join(root, "assets", "scenes");
  const dest = path.join(root, "build", "wechatgame-test");

  fs.mkdirSync(scenesDir, { recursive: true });
  fs.mkdirSync(dest, { recursive: true });

  for (const sceneName of ["MainScene", "MultiPlayerScene", "RankingScene"]) {
    fs.writeFileSync(path.join(scenesDir, `${sceneName}.scene`), "[]", "utf8");
  }

  fs.writeFileSync(path.join(dest, "engine-adapter.js"), engineAdapterContent, "utf8");
  fs.writeFileSync(path.join(dest, "project.config.json"), "{}", "utf8");
  fs.writeFileSync(path.join(dest, "game.js"), "const firstScreen = require('./first-screen');\n", "utf8");

  return { root, dest };
}

async function runAfterBuild(root, dest) {
  await hooks.onAfterBuild({ project: root, platform: "wechatgame" }, { dest });
  return fs.readFileSync(path.join(dest, "engine-adapter.js"), "utf8");
}

function writeSceneMeta(root, sceneName, uuid) {
  const scenePath = path.join(root, "assets", "scenes", `${sceneName}.scene`);
  const metaPath = `${scenePath}.meta`;
  fs.writeFileSync(scenePath, "[]", "utf8");
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        ver: "1.1.50",
        importer: "scene",
        imported: true,
        uuid,
        files: [".json"],
        subMetas: {},
        userData: {},
      },
      null,
      2
    ),
    "utf8"
  );
}

test("remote-bundle-cleaner rewrites malformed tmp guard to stable prefix check", async () => {
  const malformed = String.raw`if(/^https?:\\/\\/tmp\\//.test(t))`;
  const source =
    `!function(){function x(t,e,n){${malformed}return n(null,t);r(t,function(e){e?n(null,t):n(new Error(\"file \".concat(t,\" does not exist!\")))})};` +
    `var __REMOTE_BUNDLE_CLEANER_TMP_HTTP_GUARD__=true;function T(e,t,n){v(e,x,t,t.onFileProgress,n)}}();`;

  const { root, dest } = setupTempWechatBuild(source);
  const patched = await runAfterBuild(root, dest);

  assert.ok(patched.includes('if(0===t.indexOf("http://tmp/")||0===t.indexOf("https://tmp/"))'));
  assert.equal(patched.includes(malformed), false);
});

test("remote-bundle-cleaner also patches escaped malformed variants", async () => {
  const weirdMalformed = String.raw`if(/^https?:\\\\/\\\\/tmp\\\\//.test(t))`;
  const source =
    `!function(){function x(t,e,n){${weirdMalformed}return n(null,t);r(t,function(e){e?n(null,t):n(new Error(\"file \".concat(t,\" does not exist!\")))})};` +
    `var __REMOTE_BUNDLE_CLEANER_TMP_HTTP_GUARD__=true;function T(e,t,n){v(e,x,t,t.onFileProgress,n)}}();`;

  const { root, dest } = setupTempWechatBuild(source);
  const patched = await runAfterBuild(root, dest);

  assert.ok(
    patched.includes('if(0===t.indexOf("http://tmp/")||0===t.indexOf("https://tmp/"))'),
    "expected stable tmp-prefix guard to be present"
  );
  assert.equal(patched.includes(weirdMalformed), false, "escaped malformed tmp guard should be removed");
});

test("remote-bundle-cleaner onBeforeBuild persists normalized scenes into builder profile", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rbc-hook-prebuild-"));
  const scenesDir = path.join(root, "assets", "scenes");
  const profileDir = path.join(root, "profiles", "v2", "packages");
  fs.mkdirSync(scenesDir, { recursive: true });
  fs.mkdirSync(profileDir, { recursive: true });

  writeSceneMeta(root, "MainScene", "bdf936b3-6f67-451e-a385-47455cfa6a0e");
  writeSceneMeta(root, "MultiPlayerScene", "19805e45-80ef-4714-83af-7e591ef055fc");
  writeSceneMeta(root, "RankingScene", "8102d6d7-8a5a-43f5-88f2-3edd2ec8bffb");

  const builderProfilePath = path.join(profileDir, "builder.json");
  fs.writeFileSync(
    builderProfilePath,
    JSON.stringify(
      {
        BuildTaskManager: {
          taskMap: {
            "1": {
              id: "1",
              type: "build",
              options: {
                platform: "wechatgame",
                scenes: [
                  {
                    url: "db://assets/scenes/MainScene.scene",
                    uuid: "bdf936b3-6f67-451e-a385-47455cfa6a0e",
                  },
                  {
                    url: "db://assets/scenes/SinglePlayerScene.scene",
                    uuid: "19805e45-80ef-4714-83af-7e591ef055fc",
                  },
                ],
              },
            },
          },
        },
      },
      null,
      2
    ),
    "utf8"
  );

  const options = {
    project: root,
    platform: "wechatgame",
    scenes: [
      {
        url: "db://assets/scenes/MainScene.scene",
        uuid: "bdf936b3-6f67-451e-a385-47455cfa6a0e",
      },
      {
        url: "db://assets/scenes/SinglePlayerScene.scene",
        uuid: "19805e45-80ef-4714-83af-7e591ef055fc",
      },
    ],
  };

  await hooks.onBeforeBuild(options);

  const normalizedSet = new Set(options.scenes.map((item) => item.url));
  assert.equal(normalizedSet.has("db://assets/scenes/MainScene.scene"), true);
  assert.equal(normalizedSet.has("db://assets/scenes/MultiPlayerScene.scene"), true);
  assert.equal(normalizedSet.has("db://assets/scenes/RankingScene.scene"), true);
  assert.equal(normalizedSet.has("db://assets/scenes/SinglePlayerScene.scene"), false);

  const profile = JSON.parse(fs.readFileSync(builderProfilePath, "utf8"));
  const sceneUrls = (profile.BuildTaskManager.taskMap["1"].options.scenes ?? []).map((item) => item.url);
  const persistedSet = new Set(sceneUrls);
  assert.equal(persistedSet.has("db://assets/scenes/MainScene.scene"), true);
  assert.equal(persistedSet.has("db://assets/scenes/MultiPlayerScene.scene"), true);
  assert.equal(persistedSet.has("db://assets/scenes/RankingScene.scene"), true);
  assert.equal(persistedSet.has("db://assets/scenes/SinglePlayerScene.scene"), false);
});

test("remote-bundle-cleaner onAfterBuild patches missing RankingScene in main config", async () => {
  const rankingUuid = "8102d6d7-8a5a-43f5-88f2-3edd2ec8bffb";
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rbc-hook-postbuild-scene-"));
  const scenesDir = path.join(root, "assets", "scenes");
  const libraryDir = path.join(root, "library", "81");
  const dest = path.join(root, "build", "wechatgame-test");
  const mainImportDir = path.join(dest, "assets", "main", "import");

  fs.mkdirSync(scenesDir, { recursive: true });
  fs.mkdirSync(libraryDir, { recursive: true });
  fs.mkdirSync(mainImportDir, { recursive: true });

  writeSceneMeta(root, "MainScene", "bdf936b3-6f67-451e-a385-47455cfa6a0e");
  writeSceneMeta(root, "MultiPlayerScene", "19805e45-80ef-4714-83af-7e591ef055fc");
  writeSceneMeta(root, "RankingScene", rankingUuid);

  fs.writeFileSync(
    path.join(libraryDir, `${rankingUuid}.json`),
    JSON.stringify(
      [
        {
          __type__: "cc.SceneAsset",
          _name: "RankingScene",
          scene: { __id__: 1 },
        },
        {
          __type__: "cc.Scene",
          _name: "RankingScene",
        },
      ],
      null,
      2
    ),
    "utf8"
  );

  fs.mkdirSync(path.join(dest, "assets", "main"), { recursive: true });
  fs.writeFileSync(
    path.join(dest, "assets", "main", "config.json"),
    JSON.stringify({
      importBase: "import",
      nativeBase: "native",
      name: "main",
      deps: [],
      uuids: ["19805e45-80ef-4714-83af-7e591ef055fc", "bdf936b3-6f67-451e-a385-47455cfa6a0e"],
      paths: {
        3: ["db:/assets/scenes/MultiPlayerScene", 0, 1],
        4: ["db:/assets/scenes/MainScene", 1, 1],
      },
      scenes: {
        "db://assets/scenes/MainScene.scene": 4,
        "db://assets/scenes/MultiPlayerScene.scene": 3,
      },
      packs: {},
      versions: { import: [], native: [] },
      redirect: [],
      debug: false,
      extensionMap: {},
      hasPreloadScript: true,
      dependencyRelationships: {},
      types: ["cc.SceneAsset"],
    }),
    "utf8"
  );

  fs.writeFileSync(path.join(dest, "project.config.json"), "{}", "utf8");
  fs.writeFileSync(path.join(dest, "game.js"), "const firstScreen = require('./first-screen');\n", "utf8");

  await hooks.onAfterBuild({ project: root, platform: "wechatgame" }, { dest });

  const mainConfig = JSON.parse(fs.readFileSync(path.join(dest, "assets", "main", "config.json"), "utf8"));
  assert.equal(Boolean(mainConfig.scenes["db://assets/scenes/RankingScene.scene"]), true);

  const rankingImport = path.join(dest, "assets", "main", "import", "81", `${rankingUuid}.json`);
  assert.equal(fs.existsSync(rankingImport), true);
});
