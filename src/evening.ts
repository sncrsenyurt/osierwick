import { OsiermapFault, readOsiers } from "./osiermap.js";
import { tellWhisper, whisperNote } from "./whisper.js";
import { WickwalkFault, wickwalk } from "./wickwalk.js";
import { renderWicknote, settleWicknote, type WickMark } from "./wicknote.js";

const NOTE_PATH = "wicknote.md";

try {
  const found = readOsiers("osiers");
  const marks: WickMark[] = [];
  let broken = false;

  if (found.length === 0) {
    console.log("osierwick: no osiermaps in osiers/");
  } else {
    const noun = found.length === 1 ? "osiermap" : "osiermaps";
    console.log(`osierwick: ${found.length} ${noun}`);
    for (const { file, map } of found) {
      const door = map.door === "" ? "(empty)" : map.door;
      if (map.binds.length === 0) {
        console.log(`${file}  ${map.label}  door=${door}  binds=0`);
        marks.push({ label: map.label, kind: "quiet", step: null, ms: 0, soot: null, line: null });
        continue;
      }

      console.log(`${file}  ${map.label}  door=${door}  carrying ${map.binds.length} binds`);
      const started = Date.now();
      try {
        await wickwalk(file, map);
        const ms = Date.now() - started;
        marks.push({ label: map.label, kind: "carried", step: null, ms, soot: null, line: null });
        console.log(`${file}  ${map.label}  carried`);
      } catch (err: unknown) {
        const ms = Date.now() - started;
        if (!(err instanceof WickwalkFault)) {
          marks.push({
            label: map.label,
            kind: "failed",
            step: "walk",
            ms,
            soot: null,
            line: err instanceof Error ? (err.message.split("\n")[0] ?? err.message) : "failed",
          });
          await publish(marks);
          throw err;
        }
        console.error(err.message);
        await whisperAbout(map.whisper.to, map.label, err);
        marks.push({
          label: map.label,
          kind: "failed",
          step: err.step,
          ms,
          soot: err.soot,
          line: err.message.split("\n")[0] ?? err.message,
        });
        broken = true;
      }
    }
  }

  await publish(marks);
  if (broken) process.exit(1);
} catch (err: unknown) {
  if (err instanceof OsiermapFault) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}

async function publish(marks: WickMark[]): Promise<void> {
  const text = renderWicknote(marks);
  await settleWicknote(text, NOTE_PATH, process.env.GITHUB_STEP_SUMMARY);
  process.stdout.write(text);
}

async function whisperAbout(to: string, label: string, err: WickwalkFault): Promise<void> {
  let warning: string | null;
  try {
    warning = await tellWhisper(
      to,
      whisperNote({
        label,
        step: err.step ?? "walk",
        error: err.message.split("\n")[0] ?? err.message,
        soot: err.soot,
      }),
    );
  } catch {
    warning = "whisper did not land";
  }
  if (warning !== null) console.error(warning);
}
