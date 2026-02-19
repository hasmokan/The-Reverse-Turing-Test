# Hand-Drawn Full-Flow UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild MainScene + MultiPlayerScene into the hand-drawn full-flow UI while preserving playable draw/sync/vote/result loops.

**Architecture:** Keep `SinglePlayerController` as the phase orchestrator, but project state into rebuilt phase containers (`DrawPhase`, `SyncPhase`, `VotePhase`, `ResultPhase`) under one `GameScreenRoot`. Use Cocos-native style primitives (`cc.Sprite`, `cc.Mask(SPRITE_STENCIL)`, `cc.Button`, `cc.Label`) and MCP scene edits for node structure and style. Validate migration with scene-contract tests plus runtime manual checks.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript scripts, scene JSON (`*.scene`), Node.js built-in test runner (`node --test`), MCP scene/node/component APIs.

---

### Task 1: Add Scene Contract Test Harness

**Files:**
- Create: `tests/scene-contract/sceneContractUtils.mjs`
- Create: `tests/scene-contract/multiPlayerScene.contract.test.mjs`
- Create: `tests/scene-contract/mainScene.contract.test.mjs`
- Create: `tests/scene-contract/singlePlayerController.contract.test.mjs`

**Step 1: Write the failing tests**

```javascript
// tests/scene-contract/multiPlayerScene.contract.test.mjs
import test from node:test;
import assert from node:assert/strict;
import { readScene, findNodeByName } from ./sceneContractUtils.mjs;

test(MultiPlayerScene
