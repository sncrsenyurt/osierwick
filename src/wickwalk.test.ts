import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { Osiermap } from "./osiermap.js";
import { atIsUrlGlob, sootName, weaveWords, wickwalk, WickwalkFault } from "./wickwalk.js";

test("weaves ${NAME} into scribe words", () => {
  assert.equal(weaveWords("user@example.com", {}), "user@example.com");
  assert.equal(weaveWords("${LAMP_NOTE}", { LAMP_NOTE: "lantern-bee" }), "lantern-bee");
  assert.equal(
    weaveWords("${LAMP_NOTE}-and-${OTHER}", { LAMP_NOTE: "lantern-bee", OTHER: "wick" }),
    "lantern-bee-and-wick",
  );
  assert.equal(weaveWords("${LAMP_NOTE}", { LAMP_NOTE: "" }), "");
  assert.throws(() => weaveWords("${NO_SUCH_WICK_WORD}", {}), /\$\{NO_SUCH_WICK_WORD\} is not set/);
});

test("names soot after the label, the time, and the failing step", () => {
  const when = new Date("2026-10-10T03:57:00.123Z");
  assert.equal(sootName("porch-light", "bind-1-sight", when), "porch-light-20261010T035700123Z-bind-1-sight.png");
  assert.equal(sootName("Porch Light", "door", when), "porch-light-20261010T035700123Z-door.png");
  assert.equal(sootName("../", "door", when), "osier-20261010T035700123Z-door.png");
});

test("reads **/home as a url glob and a css at as a locator", () => {
  assert.equal(atIsUrlGlob("**/home"), true);
  assert.equal(atIsUrlGlob("https://example.com/login"), true);
  assert.equal(atIsUrlGlob("/home"), true);
  assert.equal(atIsUrlGlob("input[name=email]"), false);
  assert.equal(atIsUrlGlob("button[type=submit]"), false);
  assert.equal(atIsUrlGlob("*[name=email]"), false);
  assert.equal(atIsUrlGlob("h1"), false);
});

test("carries a door, a scribe, a nudge, and a sight glob", { timeout: 30_000 }, async () => {
  const soot = sootSandbox();
  try {
    await withLamp(async (origin) => {
      await wickwalk("osiers/lamp.toml", lamp(origin), {
        timeoutMs: 10_000,
        env: { LAMP_NOTE: "lantern-bee" },
        sootDir: soot.dir,
      });
    });
    assert.deepEqual(readdirSync(soot.dir), []);
  } finally {
    soot.remove();
  }
});

test("waits on a css sight, then the line", { timeout: 30_000 }, async () => {
  const soot = sootSandbox();
  try {
    await withLamp(async (origin) => {
      const map = lamp(origin);
      map.door = "";
      map.binds = [
        { act: "open", at: `${origin}/home?note=wick` },
        { act: "sight", at: "h1", line: "The porch is lit" },
      ];
      await wickwalk("osiers/lamp.toml", map, { timeoutMs: 10_000, env: {}, sootDir: soot.dir });
    });
    assert.deepEqual(readdirSync(soot.dir), []);
  } finally {
    soot.remove();
  }
});

test("names the file and bind index when a sight misses", { timeout: 30_000 }, async () => {
  const soot = sootSandbox();
  try {
    await withLamp(async (origin) => {
      const map = lamp(origin);
      map.door = "";
      map.binds = [
        { act: "open", at: `${origin}/` },
        { act: "sight", at: "**/*", line: "no such lantern" },
      ];
      await assert.rejects(
        () => wickwalk("osiers/lamp.toml", map, { timeoutMs: 1_000, env: {}, sootDir: soot.dir }),
        (err: unknown) => {
          assert.ok(err instanceof WickwalkFault);
          assert.equal(err.file, "osiers/lamp.toml");
          assert.equal(err.bindIndex, 1);
          assert.match(err.message, /osiers\/lamp\.toml: bind index 1: sight did not see "no such lantern"/);
          assert.ok(err.soot);
          assert.match(path.basename(err.soot), /^lamp-\d{8}T\d+Z-bind-1-sight\.png$/);
          assert.ok(err.message.includes(`soot ${err.soot}`));
          assert.ok(readFileSync(err.soot).subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])));
          return true;
        },
      );
    });
  } finally {
    soot.remove();
  }
});

test("keeps soot when the door does not open", { timeout: 30_000 }, async () => {
  const soot = sootSandbox();
  try {
    await assert.rejects(
      () =>
        wickwalk(
          "osiers/lamp.toml",
          {
            label: "porch-light",
            door: "http://127.0.0.1:9",
            binds: [{ act: "open", at: "https://example.com" }],
            whisper: { to: "" },
          },
          { timeoutMs: 2_000, env: {}, sootDir: soot.dir },
        ),
      (err: unknown) => {
        assert.ok(err instanceof WickwalkFault);
        assert.equal(err.bindIndex, null);
        assert.match(err.message, /door did not open/);
        assert.ok(err.soot);
        assert.match(path.basename(err.soot), /^porch-light-\d{8}T\d+Z-door\.png$/);
        assert.ok(statSync(err.soot).size > 8);
        return true;
      },
    );
  } finally {
    soot.remove();
  }
});

test("still names the bind when soot cannot be saved", { timeout: 30_000 }, async () => {
  const root = mkdtempSync(path.join(tmpdir(), "osierwick-blocked-"));
  const blocker = path.join(root, "blocked");
  writeFileSync(blocker, "nope");
  const sootDir = path.join(blocker, "soot");
  try {
    await withLamp(async (origin) => {
      const map = lamp(origin);
      map.door = "";
      map.binds = [
        { act: "open", at: `${origin}/` },
        { act: "sight", at: "**/*", line: "no such lantern" },
      ];
      await assert.rejects(
        () => wickwalk("osiers/lamp.toml", map, { timeoutMs: 1_000, env: {}, sootDir }),
        (err: unknown) => {
          assert.ok(err instanceof WickwalkFault);
          assert.equal(err.bindIndex, 1);
          assert.equal(err.soot, null);
          assert.match(err.message, /bind index 1: sight did not see "no such lantern"/);
          assert.equal(err.message.includes("soot "), false);
          return true;
        },
      );
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function sootSandbox(): { dir: string; remove: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), "osierwick-soot-"));
  mkdirSync(dir, { recursive: true });
  return {
    dir,
    remove: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function lamp(origin: string): Osiermap {
  return {
    label: "lamp",
    door: `${origin}/`,
    whisper: { to: "" },
    binds: [
      { act: "scribe", at: "input[name=note]", words: "${LAMP_NOTE}" },
      { act: "nudge", at: "#go" },
      { act: "sight", at: "**/home*", line: "lantern-bee" },
    ],
  };
}

async function withLamp(run: (origin: string) => Promise<void>): Promise<void> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/favicon.ico") {
      res.writeHead(404);
      res.end();
      return;
    }
    const body = url.pathname === "/home" ? homePage(url.searchParams.get("note") ?? "") : doorPage();
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(body);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("lamp server did not bind");
  }

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

function doorPage(): string {
  return `<!doctype html>
<html>
  <body>
    <label>Note <input name="note" /></label>
    <button type="button" id="go">Step in</button>
    <script>
      document.getElementById("go").addEventListener("click", () => {
        const note = document.querySelector("input[name=note]").value;
        location.assign("/home?note=" + encodeURIComponent(note));
      });
    </script>
  </body>
</html>`;
}

function homePage(note: string): string {
  return `<!doctype html>
<html>
  <body>
    <h1>The porch is lit</h1>
    <p>${escapeHtml(note)}</p>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
