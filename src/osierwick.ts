import { OsiermapFault, readOsiers } from "./osiermap.js";
import { tellWhisper, whisperNote } from "./whisper.js";
import { WickwalkFault, wickwalk } from "./wickwalk.js";

try {
  const found = readOsiers("osiers");
  if (found.length === 0) {
    console.log("osierwick: no osiermaps in osiers/");
  } else {
    const noun = found.length === 1 ? "osiermap" : "osiermaps";
    console.log(`osierwick: ${found.length} ${noun}`);
    for (const { file, map } of found) {
      const door = map.door === "" ? "(empty)" : map.door;
      if (map.binds.length === 0) {
        console.log(`${file}  ${map.label}  door=${door}  binds=0`);
        continue;
      }
      console.log(`${file}  ${map.label}  door=${door}  carrying ${map.binds.length} binds`);
      try {
        await wickwalk(file, map);
      } catch (err: unknown) {
        if (!(err instanceof WickwalkFault)) throw err;
        console.error(err.message);
        await warnWhisper(map.whisper.to, map.label, err);
        process.exit(1);
      }
      console.log(`${file}  ${map.label}  carried`);
    }
  }
} catch (err: unknown) {
  if (err instanceof OsiermapFault) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}

async function warnWhisper(to: string, label: string, err: WickwalkFault): Promise<void> {
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
