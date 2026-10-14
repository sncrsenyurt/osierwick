import { appendFile, writeFile } from "node:fs/promises";

export type WickMark = {
  label: string;
  kind: "quiet" | "carried" | "failed";
  step: string | null;
  ms: number;
  soot: string | null;
  line: string | null;
};

export function renderWicknote(marks: WickMark[], when = new Date()): string {
  const stamp = `${when.toISOString().slice(0, 16).replace("T", " ")}Z`;
  const lines = ["# wicknote", "", stamp, ""];
  for (const mark of marks) {
    lines.push(renderMark(mark));
  }
  lines.push("", closing(marks), "");
  return lines.join("\n");
}

export async function settleWicknote(
  text: string,
  notePath: string,
  summaryPath: string | undefined,
): Promise<void> {
  const body = text.endsWith("\n") ? text : `${text}\n`;
  await writeFile(notePath, body, "utf8");
  if (summaryPath) {
    await appendFile(summaryPath, body, "utf8");
  }
}

function renderMark(mark: WickMark): string {
  if (mark.kind === "quiet") {
    return `- ${mark.label} — quiet`;
  }
  const span = formatSpan(mark.ms);
  if (mark.kind === "carried") {
    return `- ${mark.label} — carried — ${span}`;
  }
  const step = mark.step ?? "walk";
  const lines = [`- ${mark.label} — failed at ${step} — ${span}`];
  if (mark.line) lines.push(`  ${mark.line}`);
  if (mark.soot) lines.push(`  soot ${mark.soot}`);
  return lines.join("\n");
}

function closing(marks: WickMark[]): string {
  const failed = marks.filter((mark) => mark.kind === "failed").length;
  if (failed === 1) return "1 failed";
  if (failed > 1) return `${failed} failed`;
  if (marks.some((mark) => mark.kind === "carried")) return "all carried";
  return "nothing walked";
}

function formatSpan(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  const text = seconds >= 10 ? seconds.toFixed(0) : seconds.toFixed(1);
  return `${text}s`;
}
