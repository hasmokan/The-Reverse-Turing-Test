import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../../assets/scripts/network/APIService.ts", import.meta.url),
  "utf-8",
);

test("APIService guest login payload uses camelCase keys for backend auth contract", () => {
  assert.match(source, /payload\s*:\s*Record<string,\s*string>\s*=\s*\{/);
  assert.match(source, /deviceToken:\s*storedDeviceToken/);
  assert.match(source, /payload\.sessionId\s*=\s*sessionId/);

  assert.doesNotMatch(source, /device_token:\s*storedDeviceToken/);
  assert.doesNotMatch(source, /payload\.session_id\s*=\s*sessionId/);
});
