import { OsiermapFault, readOsiers } from "./osiermap.js";

try {
  const found = readOsiers("osiers");
  if (found.length === 0) {
    console.log("osierwick: no osiermaps in osiers/");
  } else {
    const noun = found.length === 1 ? "osiermap" : "osiermaps";
    console.log(`osierwick: ${found.length} ${noun}`);
    for (const { file, map } of found) {
      const door = map.door === "" ? "(empty)" : map.door;
      console.log(`${file}  ${map.label}  door=${door}  binds=${map.binds.length}`);
    }
  }
} catch (err: unknown) {
  if (err instanceof OsiermapFault) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}
