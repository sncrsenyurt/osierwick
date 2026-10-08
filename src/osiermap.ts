import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse, TomlError } from "smol-toml";

const ACTS = ["open", "scribe", "nudge", "sight"] as const;

export type BindAct = (typeof ACTS)[number];

export type OpenBind = { act: "open"; at: string };
export type ScribeBind = { act: "scribe"; at: string; words: string };
export type NudgeBind = { act: "nudge"; at: string };
export type SightBind = { act: "sight"; at: string; line: string };
export type Bind = OpenBind | ScribeBind | NudgeBind | SightBind;

export type Osiermap = {
  label: string;
  door: string;
  binds: Bind[];
  whisper: { to: string };
};

export type LoadedOsier = {
  file: string;
  map: Osiermap;
};

const ALLOWED: Record<BindAct, readonly string[]> = {
  open: ["act", "at"],
  scribe: ["act", "at", "words"],
  nudge: ["act", "at"],
  sight: ["act", "at", "line"],
};

const TOP_FIELDS = ["label", "door", "binds", "whisper"];

export class OsiermapFault extends Error {
  readonly file: string;
  readonly bindIndex: number | null;

  constructor(file: string, detail: string, bindIndex?: number) {
    const head = bindIndex === undefined ? file : `${file}: bind index ${bindIndex}`;
    super(`${head}: ${detail}`);
    this.name = "OsiermapFault";
    this.file = file;
    this.bindIndex = bindIndex ?? null;
  }
}

export function parseOsiermap(file: string, value: unknown): Osiermap {
  if (!isRecord(value)) {
    throw new OsiermapFault(file, "top level must be a table");
  }

  for (const key of Object.keys(value)) {
    if (!TOP_FIELDS.includes(key)) {
      throw new OsiermapFault(file, `unknown field "${key}"`);
    }
  }

  if (typeof value.label !== "string" || value.label.trim() === "") {
    throw new OsiermapFault(file, "label must be a non-empty string");
  }
  if (typeof value.door !== "string") {
    throw new OsiermapFault(file, "door must be a string");
  }
  if (!("binds" in value)) {
    throw new OsiermapFault(file, "missing binds");
  }
  if (!("whisper" in value)) {
    throw new OsiermapFault(file, "missing whisper");
  }

  return {
    label: value.label.trim(),
    door: value.door.trim(),
    binds: parseBinds(file, value.binds),
    whisper: parseWhisper(file, value.whisper),
  };
}

export function readOsiers(dir = "osiers"): LoadedOsier[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err: unknown) {
    if (isEnoent(err)) {
      throw new OsiermapFault(dir, "folder not found");
    }
    throw err;
  }

  const names = entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith(".") && entry.name.endsWith(".toml"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  return names.map((name) => readOne(dir, name));
}

function readOne(dir: string, name: string): LoadedOsier {
  const file = path.join(dir, name);
  const text = readFileSync(file, "utf8");
  let raw: unknown;
  try {
    raw = parse(text);
  } catch (err: unknown) {
    if (err instanceof TomlError) {
      throw new OsiermapFault(file, err.message);
    }
    throw err;
  }
  return { file, map: parseOsiermap(file, raw) };
}

function parseBinds(file: string, value: unknown): Bind[] {
  if (!Array.isArray(value)) {
    throw new OsiermapFault(file, "binds must be an array");
  }
  return value.map((item, index) => parseBind(file, index, item));
}

function parseBind(file: string, index: number, value: unknown): Bind {
  if (!isRecord(value)) {
    throw new OsiermapFault(file, "expected a table", index);
  }

  const act = readAct(file, index, value);
  for (const key of Object.keys(value)) {
    if (!ALLOWED[act].includes(key)) {
      throw new OsiermapFault(file, `unknown field "${key}"`, index);
    }
  }

  const at = readText(file, index, value, "at");
  if (act === "scribe") {
    return { act, at, words: readText(file, index, value, "words") };
  }
  if (act === "sight") {
    return { act, at, line: readText(file, index, value, "line") };
  }
  return { act, at };
}

function readAct(file: string, index: number, value: Record<string, unknown>): BindAct {
  const act = value.act;
  if (typeof act === "string" && isAct(act)) {
    return act;
  }
  const got = typeof act === "string" ? ` (got "${act}")` : "";
  throw new OsiermapFault(file, `act must be open, scribe, nudge, or sight${got}`, index);
}

function readText(file: string, index: number, value: Record<string, unknown>, key: string): string {
  const raw = value[key];
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new OsiermapFault(file, `"${key}" must be a non-empty string`, index);
  }
  return raw;
}

function parseWhisper(file: string, value: unknown): { to: string } {
  if (!isRecord(value)) {
    throw new OsiermapFault(file, "whisper must be a table");
  }
  for (const key of Object.keys(value)) {
    if (key !== "to") {
      throw new OsiermapFault(file, `unknown field "whisper.${key}"`);
    }
  }
  if (typeof value.to !== "string") {
    throw new OsiermapFault(file, "whisper.to must be a string");
  }
  return { to: value.to.trim() };
}

function isAct(value: string): value is BindAct {
  return (ACTS as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEnoent(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "ENOENT";
}
