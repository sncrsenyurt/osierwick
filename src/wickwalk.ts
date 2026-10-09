import { chromium, type Browser, type Page } from "playwright";
import type { Bind, Osiermap, SightBind } from "./osiermap.js";

const WORD_HOLE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

export type WickwalkOpts = {
  headless?: boolean;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
};

export class WickwalkFault extends Error {
  readonly file: string;
  readonly bindIndex: number | null;

  constructor(file: string, detail: string, bindIndex?: number) {
    const head = bindIndex === undefined ? file : `${file}: bind index ${bindIndex}`;
    super(`${head}: ${detail}`);
    this.name = "WickwalkFault";
    this.file = file;
    this.bindIndex = bindIndex ?? null;
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

export async function wickwalk(file: string, map: Osiermap, opts: WickwalkOpts = {}): Promise<void> {
  const headless = opts.headless ?? true;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const env = opts.env ?? process.env;

  let browser: Browser | undefined;
  try {
    try {
      browser = await chromium.launch({ headless });
    } catch (err: unknown) {
      throw new WickwalkFault(file, `browser did not start: ${shortReason(err)}`);
    }

    const page = await browser.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);

    if (map.door !== "") {
      try {
        await page.goto(map.door, { waitUntil: "domcontentloaded" });
      } catch (err: unknown) {
        throw new WickwalkFault(file, `door did not open (${map.door}): ${shortReason(err)}`);
      }
    }

    for (const [index, bind] of map.binds.entries()) {
      try {
        await carryBind(page, bind, env);
      } catch (err: unknown) {
        throw new WickwalkFault(file, detailFor(bind, err), index);
      }
    }
  } finally {
    await browser?.close();
  }
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
