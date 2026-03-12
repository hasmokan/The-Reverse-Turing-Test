import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const cocosSocketSource = fs.readFileSync(
  new URL("../../assets/scripts/network/SocketClient.ts", import.meta.url),
  "utf-8",
);

test("cocos socket client handles phase:update and emits vote payloads without voterId", () => {
  assert.match(cocosSocketSource, /this\._socket\.on\('phase:update'/);
  assert.match(cocosSocketSource, /phase:\s*data\.phase/);
  assert.match(cocosSocketSource, /roomId:\s*data\.roomId/);

  assert.match(cocosSocketSource, /this\.emit\('vote:cast',\s*\{\s*fishId\s*\}\)/);
  assert.match(cocosSocketSource, /this\.emit\('vote:retract',\s*\{\s*fishId\s*\}\)/);
  assert.match(cocosSocketSource, /this\.emit\('vote:chase',\s*\{\s*fishId\s*\}\)/);

  assert.doesNotMatch(cocosSocketSource, /this\.emit\('vote:(?:cast|retract|chase)',\s*\{[^}]*voterId/);
});

test("cocos socket client handles vote:error compatibility reasons", () => {
  assert.match(cocosSocketSource, /this\._socket\.on\('vote:error'/);
  assert.match(cocosSocketSource, /data\?\.reason === 'not_voting'/);
  assert.match(cocosSocketSource, /data\?\.reason === 'chase_disabled'/);
});
