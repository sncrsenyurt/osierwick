import { OsiermapFault, readOsiers } from "./osiermap.js";
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
      await wickwalk(file, map);
      console.log(`${file}  ${map.label}  carried`);
    }
  }
} catch (err: unknown) {
  if (err instanceof OsiermapFault || err instanceof WickwalkFault) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}
