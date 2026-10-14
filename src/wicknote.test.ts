import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { renderWicknote, settleWicknote, type WickMark } from "./wicknote.js";

const when = new Date("2026-10-14T06:20:00.000Z");

test("notes a quiet osier, a carried walk, and a failed step", () => {
  const marks: WickMark[] = [
    { label: "porch-light", kind: "quiet", step: null, ms: 0, soot: null, line: null },
    { label: "lamp", kind: "carried", step: null, ms: 1500, soot: null, line: null },
    {
      label: "side-door",
      kind: "failed",
      step: "bind-1-sight",
      ms: 420,
      soot: "soot/side-door-sight.png",
      line: "osiers/side-door.toml: bind index 1: sight did not see \"home\"",
    },
  ];
  assert.equal(
    renderWicknote(marks, when),
    [
      "# wicknote",
      "",
      "2026-10-14 06:20Z",
      "",
      "- porch-light — quiet",
      "- lamp — carried — 1.5s",
      "- side-door — failed at bind-1-sight — 420ms",
      "  osiers/side-door.toml: bind index 1: sight did not see \"home\"",
      "  soot soot/side-door-sight.png",
      "",
      "1 failed",
      "",
    ].join("\n"),
  );
});

test("says nothing walked when every osier is quiet", () => {
  const text = renderWicknote(
    [{ label: "porch-light", kind: "quiet", step: null, ms: 0, soot: null, line: null }],
    when,
  );
  assert.match(text, /porch-light — quiet/);
  assert.match(text, /nothing walked/);
});

test("says all carried when none failed", () => {
  const text = renderWicknote(
    [{ label: "lamp", kind: "carried", step: null, ms: 800, soot: null, line: null }],
    when,
  );
  assert.match(text, /lamp — carried — 800ms/);
  assert.match(text, /all carried/);
});

test("writes the note and appends the step summary when one is set", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "wicknote-"));
  const note = path.join(dir, "wicknote.md");
  const summary = path.join(dir, "summary.md");
  const text = renderWicknote(
    [{ label: "porch-light", kind: "quiet", step: null, ms: 0, soot: null, line: null }],
    when,
  );
  await settleWicknote(text, note, summary);
  assert.equal(readFileSync(note, "utf8"), text);
  assert.equal(readFileSync(summary, "utf8"), text);
});

test("leaves the summary alone when GITHUB_STEP_SUMMARY is unset", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "wicknote-"));
  const note = path.join(dir, "wicknote.md");
  const text = "# wicknote\n\nnothing walked\n";
  await settleWicknote(text, note, undefined);
  assert.equal(readFileSync(note, "utf8"), text);
});
