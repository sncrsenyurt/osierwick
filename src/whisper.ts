const HOOK_NAME = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$|^\$([A-Za-z_][A-Za-z0-9_]*)$/;
const NOTE_CAP = 1800;

export type WhisperSlip = {
  label: string;
  step: string;
  error: string;
  soot: string | null;
};

export type WhisperPost = (url: string, body: string) => Promise<{ ok: boolean; status: number }>;

type HookName = { kind: "quiet" } | { kind: "warn"; warning: string } | { kind: "name"; name: string };

export function whisperNote(slip: WhisperSlip): string {
  const lines = [`${slip.label} failed at ${slip.step}`, slip.error];
  if (slip.soot !== null && slip.soot !== "") {
    lines.push(`soot ${slip.soot}`);
  }
  return lines.join("\n");
}

export async function tellWhisper(
  to: string,
  note: string,
  env: NodeJS.ProcessEnv = process.env,
  post: WhisperPost = postHook,
): Promise<string | null> {
  const named = readHookName(to);
  if (named.kind === "quiet") return null;
  if (named.kind === "warn") return named.warning;

  const raw = env[named.name];
  if (raw === undefined || raw.trim() === "") {
    return `whisper did not land (${named.name} is not set)`;
  }

  const kind = hookKind(raw.trim());
  if (kind === null) {
    return "whisper did not understand the hook";
  }

  try {
    const result = await post(raw.trim(), whisperBody(kind, note));
    if (!result.ok) {
      return `whisper did not land (${kind} ${result.status})`;
    }
    return null;
  } catch {
    return "whisper did not land";
  }
}

function readHookName(to: string): HookName {
  const trimmed = to.trim();
  if (trimmed === "") return { kind: "quiet" };
  const match = HOOK_NAME.exec(trimmed);
  const name = match?.[1] ?? match?.[2];
  if (name === undefined) {
    return { kind: "warn", warning: "whisper.to should name an env var like $OSIER_WHISPER_HOOK" };
  }
  return { kind: "name", name };
}

// Discord hosts get { content }. Slack hosts get { text }.
function hookKind(url: string): "discord" | "slack" | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();
  if (
    host === "discord.com" ||
    host === "discordapp.com" ||
    host.endsWith(".discord.com") ||
    host.endsWith(".discordapp.com")
  ) {
    return "discord";
  }
  if (host === "hooks.slack.com" || host.endsWith(".slack.com")) {
    return "slack";
  }
  return null;
}

function whisperBody(kind: "discord" | "slack", note: string): string {
  const text = note.length > NOTE_CAP ? `${note.slice(0, NOTE_CAP)}...` : note;
  if (kind === "discord") return JSON.stringify({ content: text });
  return JSON.stringify({ text });
}

async function postHook(url: string, body: string): Promise<{ ok: boolean; status: number }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  await response.arrayBuffer().catch(() => undefined);
  return { ok: response.ok, status: response.status };
}
