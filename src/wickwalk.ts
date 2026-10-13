import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import type { Bind, Osiermap, SightBind } from "./osiermap.js";

const WORD_HOLE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
const SOOT_DIR = "soot";

export type WickwalkOpts = {
  headless?: boolean;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  sootDir?: string;
};

export class WickwalkFault extends Error {
  readonly file: string;
  readonly bindIndex: number | null;
  readonly soot: string | null;
  readonly step: string | null;

  constructor(
    file: string,
    detail: string,
    bindIndex?: number,
    soot: string | null = null,
    step: string | null = null,
  ) {
    const head = bindIndex === undefined ? file : `${file}: bind index ${bindIndex}`;
    const body = soot === null ? detail : `${detail}\nsoot ${soot}`;
    super(`${head}: ${body}`);
    this.name = "WickwalkFault";
    this.file = file;
    this.bindIndex = bindIndex ?? null;
    this.soot = soot;
    this.step = step;
  }
}

// porch-light writes sight `at` as a URL glob (`**/home`). Anything else is a locator.
export function atIsUrlGlob(at: string): boolean {
  if (at.includes("**")) {
    return true;
  }
  if (/^https?:\/\//i.test(at)) {
    return true;
  }
  if (at.startsWith("/")) {
    return true;
  }
  return at.startsWith("*") && !at.includes("[");
}

export function weaveWords(words: string, env: NodeJS.ProcessEnv = process.env): string {
  return words.replace(WORD_HOLE, (_whole, name: string) => {
    const value = env[name];
    if (value === undefined) {
      throw new Error(`\${${name}} is not set`);
    }
    return value;
  });
}

export function sootName(label: string, step: string, when = new Date()): string {
  const stamp = when.toISOString().replace(/[-:]/g, "").replace(".", "");
  return `${fileToken(label)}-${stamp}-${fileToken(step)}.png`;
}

export async function wickwalk(file: string, map: Osiermap, opts: WickwalkOpts = {}): Promise<void> {
  const headless = opts.headless ?? true;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const env = opts.env ?? process.env;
  const sootDir = opts.sootDir ?? SOOT_DIR;

  let browser: Browser | undefined;
  try {
    try {
      browser = await chromium.launch({ headless });
    } catch (err: unknown) {
      throw new WickwalkFault(file, `browser did not start: ${shortReason(err)}`, undefined, null, "browser");
    }

    const page = await browser.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);

    if (map.door !== "") {
      try {
        await page.goto(map.door, { waitUntil: "domcontentloaded" });
      } catch (err: unknown) {
        await breakWalk(page, file, map.label, sootDir, "door", `door did not open (${map.door}): ${shortReason(err)}`);
      }
    }

    for (const [index, bind] of map.binds.entries()) {
      try {
        await carryBind(page, bind, env);
      } catch (err: unknown) {
        await breakWalk(page, file, map.label, sootDir, `bind-${index}-${bind.act}`, detailFor(bind, err), index);
      }
    }
  } finally {
    await browser?.close();
  }
}

async function breakWalk(
  page: Page,
  file: string,
  label: string,
  sootDir: string,
  step: string,
  detail: string,
  bindIndex?: number,
): Promise<never> {
  const soot = await keepSoot(page, sootDir, label, step);
  throw new WickwalkFault(file, detail, bindIndex, soot, step);
}

async function keepSoot(page: Page, sootDir: string, label: string, step: string): Promise<string | null> {
  const dest = path.join(sootDir, sootName(label, step));
  try {
    await mkdir(sootDir, { recursive: true });
    await page.screenshot({ path: dest, fullPage: true, type: "png" });
    return dest;
  } catch {
    return null;
  }
}

function fileToken(value: string): string {
  const token = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return token === "" ? "osier" : token;
}

async function carryBind(page: Page, bind: Bind, env: NodeJS.ProcessEnv): Promise<void> {
  switch (bind.act) {
    case "open":
      await page.goto(bind.at, { waitUntil: "domcontentloaded" });
      return;
    case "scribe":
      await page.locator(bind.at).fill(weaveWords(bind.words, env));
      return;
    case "nudge":
      await page.locator(bind.at).click();
      return;
    case "sight":
      await lookFor(page, bind);
      return;
  }
}

async function lookFor(page: Page, bind: SightBind): Promise<void> {
  if (atIsUrlGlob(bind.at)) {
    await page.waitForURL(bind.at, { waitUntil: "domcontentloaded" });
  } else {
    await page.locator(bind.at).waitFor({ state: "visible" });
  }
  await page.getByText(bind.line).first().waitFor({ state: "visible" });
}

function detailFor(bind: Bind, err: unknown): string {
  const why = shortReason(err);
  switch (bind.act) {
    case "open":
      return `open did not reach ${bind.at} (${why})`;
    case "scribe":
      return `scribe could not fill ${bind.at} (${why})`;
    case "nudge":
      return `nudge could not click ${bind.at} (${why})`;
    case "sight":
      return `sight did not see "${bind.line}" at ${bind.at} (${why})`;
  }
}

function shortReason(err: unknown): string {
  const raw = err instanceof Error ? err.message : "failed";
  const line = raw.split("\n")[0]?.trim() || "failed";
  return line.length > 200 ? `${line.slice(0, 200)}...` : line;
}
