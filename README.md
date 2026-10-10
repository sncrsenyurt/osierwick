# osierwick

I keep finding a site is broken only when I try to sign in. The homepage still answers. I want a small program that opens the door, types, presses the button, and checks that a line of text is actually there.

The reader exists, and the walker can carry out binds. When a door or a bind fails, it keeps a full-page picture under `soot/`. Still no whisper, no CI.

## Osiermaps

Each `osiers/*.toml` is one walk. `npm run check` loads them. A map with no binds is only listed. `npm run walk` is the same load: a map that has binds is carried out in a browser.

- `label` — name in that list
- `door` — opened once before the binds, when it is not empty
- `binds` — in order: `open` (`at`), `scribe` (`at`, `words`), `nudge` (`at`), `sight` (`at`, `line`)
- `whisper.to` — where a failure would go, later

`open` goes to `at`. `scribe` fills that locator; `${NAME}` in `words` comes from the environment. `nudge` clicks. `sight` treats `at` as a URL glob such as `**/home`, then looks for `line`. If `at` is a CSS selector instead, it waits for that locator and then looks for the line.

A bad file stops the load. A bind that fails stops the walk. The message names the file, the bind index, and the soot picture.

`osiers/porch-light.toml` is still an empty walk. I left the binds commented out.

## What is still missing

- A note to Discord or Slack (`whisper.to`)

## Stack

TypeScript, Playwright, Node 18 or newer. TOML via smol-toml.

## Install

```bash
npm install
npx playwright install chromium
npm run check
```

## License

MIT. See [LICENSE](LICENSE).
