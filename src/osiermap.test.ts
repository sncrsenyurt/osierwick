import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { OsiermapFault, parseOsiermap, readOsiers } from "./osiermap.js";

const file = "osiers/porch-light.toml";

function faultFrom(run: () => void): OsiermapFault {
  try {
    run();
  } catch (err: unknown) {
    assert.ok(err instanceof OsiermapFault);
    return err;
  }
  assert.fail("expected an OsiermapFault");
}

test("reads the porch-light demo", () => {
  const found = readOsiers("osiers");
  assert.equal(found.length, 1);
  const first = found[0];
  assert.ok(first);
  assert.equal(first.file, "osiers/porch-light.toml");
  assert.equal(first.map.label, "porch-light");
  assert.equal(first.map.door, "https://example.com");
  assert.deepEqual(
    first.map.binds.map((bind) => bind.act),
    ["open", "sight"],
  );
  const sight = first.map.binds[1];
  assert.ok(sight && sight.act === "sight");
  assert.equal(sight.line, "This domain is for use in documentation examples without needing permission.");
  assert.equal(first.map.whisper.to, "");
});

test("accepts one of each bind", () => {
  const map = parseOsiermap(file, {
    label: "porch-light",
    door: "https://example.com/login",
    binds: [
      { act: "open", at: "https://example.com/login" },
      { act: "scribe", at: "input[name=email]", words: "user@example.com" },
      { act: "nudge", at: "button[type=submit]" },
      { act: "sight", at: "**/home", line: "Signed in" },
    ],
    whisper: { to: "" },
  });
  assert.deepEqual(
    map.binds.map((bind) => bind.act),
    ["open", "scribe", "nudge", "sight"],
  );
});

test("names the file and bind index when act is wrong", () => {
  const err = faultFrom(() =>
    parseOsiermap(file, {
      label: "porch-light",
      door: "",
      binds: [
        { act: "open", at: "https://example.com" },
        { act: "click", at: "button" },
      ],
      whisper: { to: "" },
    }),
  );
  assert.equal(err.bindIndex, 1);
  assert.equal(
    err.message,
    'osiers/porch-light.toml: bind index 1: act must be open, scribe, nudge, or sight (got "click")',
  );
});

test("names the bind that is missing words", () => {
  const err = faultFrom(() =>
    parseOsiermap(file, {
      label: "porch-light",
      door: "",
      binds: [{ act: "scribe", at: "input[name=email]" }],
      whisper: { to: "" },
    }),
  );
  assert.equal(err.bindIndex, 0);
  assert.match(err.message, /bind index 0: "words" must be a non-empty string/);
});

test("names the file when the toml is broken", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "osierwick-"));
  try {
    writeFileSync(path.join(dir, "side-door.toml"), "label = [\n");
    const broken = faultFrom(() => readOsiers(dir));
    assert.match(broken.message, /side-door\.toml/);
    assert.match(broken.message, /Invalid TOML document/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("names the sight bind that forgot its line", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "osierwick-"));
  try {
    writeFileSync(
      path.join(dir, "porch-light.toml"),
      [
        'label = "porch-light"',
        'door = "https://example.com"',
        "[[binds]]",
        'act = "open"',
        'at = "https://example.com/login"',
        "[[binds]]",
        'act = "nudge"',
        'at = "button[type=submit]"',
        "[[binds]]",
        'act = "sight"',
        'at = "**/home"',
        "",
        "[whisper]",
        'to = ""',
        "",
      ].join("\n"),
    );
    const sight = faultFrom(() => readOsiers(dir));
    assert.equal(sight.bindIndex, 2);
    assert.match(sight.file, /porch-light\.toml$/);
    assert.match(sight.message, /bind index 2: "line" must be a non-empty string/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
