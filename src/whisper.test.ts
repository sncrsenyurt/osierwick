import assert from "node:assert/strict";
import { test } from "node:test";
import { tellWhisper, whisperNote, type WhisperPost } from "./whisper.js";

const note = "porch-light failed at bind-1-sight\nsight missed the line\nsoot soot/porch-light.png";

test("writes the osier, the step, one error line, and the soot path", () => {
  assert.equal(
    whisperNote({
      label: "porch-light",
      step: "bind-1-sight",
      error: "sight missed the line",
      soot: "soot/porch-light.png",
    }),
    "porch-light failed at bind-1-sight\nsight missed the line\nsoot soot/porch-light.png",
  );
  assert.equal(
    whisperNote({ label: "porch-light", step: "door", error: "door did not open", soot: null }),
    "porch-light failed at door\ndoor did not open",
  );
});

test("stays quiet when whisper.to is empty", async () => {
  const post = bomb();
  assert.equal(await tellWhisper("", note, {}, post), null);
  assert.equal(await tellWhisper("   ", note, {}, post), null);
});

test("posts discord content from $OSIER_WHISPER_HOOK", async () => {
  const calls: { url: string; body: string }[] = [];
  const warning = await tellWhisper("$OSIER_WHISPER_HOOK", note, {
    OSIER_WHISPER_HOOK: "https://discord.com/api/webhooks/1/token",
  }, record(calls, { ok: true, status: 204 }));
  assert.equal(warning, null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://discord.com/api/webhooks/1/token");
  assert.deepEqual(JSON.parse(calls[0]?.body ?? ""), { content: note });
});

test("posts slack text from ${OSIER_WHISPER_HOOK}", async () => {
  const calls: { url: string; body: string }[] = [];
  const warning = await tellWhisper("${OSIER_WHISPER_HOOK}", note, {
    OSIER_WHISPER_HOOK: "https://hooks.slack.com/services/T0/B0/secret",
  }, record(calls, { ok: true, status: 200 }));
  assert.equal(warning, null);
  assert.deepEqual(JSON.parse(calls[0]?.body ?? ""), { text: note });
});

test("warns when the env var is unset and does not post", async () => {
  const post = bomb();
  const warning = await tellWhisper("$OSIER_WHISPER_HOOK", note, {}, post);
  assert.match(warning ?? "", /OSIER_WHISPER_HOOK is not set/);
});

test("refuses a hook written into the osier", async () => {
  const post = bomb();
  const warning = await tellWhisper("https://discord.com/api/webhooks/1/secret", note, {}, post);
  assert.match(warning ?? "", /\$OSIER_WHISPER_HOOK/);
});

test("warns on a host that is neither discord nor slack", async () => {
  const post = bomb();
  const warning = await tellWhisper("$OSIER_WHISPER_HOOK", note, {
    OSIER_WHISPER_HOOK: "https://example.com/hook",
  }, post);
  assert.equal(warning, "whisper did not understand the hook");
});

test("warns when the hook answers non-2xx", async () => {
  const warning = await tellWhisper("$OSIER_WHISPER_HOOK", note, {
    OSIER_WHISPER_HOOK: "https://hooks.slack.com/services/T0/B0/secret",
  }, async () => ({ ok: false, status: 500 }));
  assert.equal(warning, "whisper did not land (slack 500)");
});

test("warns when the hook cannot be reached", async () => {
  const warning = await tellWhisper("$OSIER_WHISPER_HOOK", note, {
    OSIER_WHISPER_HOOK: "https://discord.com/api/webhooks/1/token",
  }, async () => {
    throw new Error("ECONNREFUSED");
  });
  assert.equal(warning, "whisper did not land");
});

function record(
  calls: { url: string; body: string }[],
  result: { ok: boolean; status: number },
): WhisperPost {
  return async (url, body) => {
    calls.push({ url, body });
    return result;
  };
}

function bomb(): WhisperPost {
  return async () => {
    throw new Error("whisper should not have posted");
  };
}
