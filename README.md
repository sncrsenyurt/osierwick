# osierwick

I keep finding a site is broken only when I try to sign in. The homepage still answers. I want a small program that opens the door, types, presses the button, and checks that a line of text is actually there.

The reader exists. The browser part does not. No alerts, no CI.

## Osiermaps

Each `osiers/*.toml` is one walk. `npm run check` loads them and prints the label, the door, and how many binds are in the file.

- `label` — name in that list
- `door` — where the walk would start
- `binds` — in order: `open` (`at`), `scribe` (`at`, `words`), `nudge` (`at`), `sight` (`at`, `line`)
- `whisper.to` — where a failure would go, later

A bad file stops the check. The message names the file and, when a bind is wrong, the bind index.

`osiers/porch-light.toml` is still an empty walk. I left the binds commented out.

## What is still missing

- Playwright actually carrying out a bind
- A note to Discord or Slack when one fails, with a screenshot

## Stack

TypeScript, Playwright, Node 18 or newer. TOML via smol-toml.

## Install

```bash
npm install
npm run check
```

## License

MIT. See [LICENSE](LICENSE).
