# osierwick

I keep finding a site is broken only when I try to sign in. The homepage still answers. I want a small program that opens the door, types, presses the button, and checks that a line of text is actually there.

That program is this repo. An osiermap says where to start and which binds to carry out. `npm run walk` does the carrying. `npm run evening` does the same and writes a wicknote.

## Osiermaps

Each `osiers/*.toml` is one walk.

- `label` — the name in the note
- `door` — opened once before the binds, when it is not empty
- `binds` — in order: `open` (`at`), `scribe` (`at`, `words`), `nudge` (`at`), `sight` (`at`, `line`)
- `whisper.to` — `$OSIER_WHISPER_HOOK`, or empty to stay quiet

`open` goes to `at`. `scribe` fills that locator; `${NAME}` in `words` comes from the environment. `nudge` clicks. `sight` treats `at` as a URL glob, then looks for `line` on the page. If `at` is a CSS selector instead, it waits for that locator and then looks for the line.

A bad file stops the load. A bind that fails stops that walk. The message names the file, the bind index, and the soot picture under `soot/`. A walk that carries through does not take one.

## porch-light

`osiers/porch-light.toml` is a live demo. No login. The door and the open bind both go to `https://example.com`, and the sight looks for the line about documentation examples. `npm run walk` should carry it.

`whisper.to` is empty there, so a failure stays on this machine. When I want a note sent, I set it to `$OSIER_WHISPER_HOOK`. The URL itself lives in the environment, not in the file. On GitHub that value is the repo secret `OSIER_WHISPER_HOOK`, a Discord or Slack incoming webhook. The host decides which shape gets posted.

## wicknote

`npm run evening` walks every osier, then writes `wicknote.md`. Each line is quiet (no binds), carried, or failed, with the step that broke and how long it took. If `GITHUB_STEP_SUMMARY` is set, the same note is appended there.

Weekday mornings at 06:20 UTC, `.github/workflows/wicknote.yml` runs that evening walk. I can also start it by hand. It installs the dependencies and the Playwright browser, and passes `OSIER_WHISPER_HOOK` in. If a walk fails, the job fails and the soot pictures are uploaded. A morning that carries through uploads nothing.

`npm run check` typechecks and prints the list the walk starts from. A map with no binds is only listed.

## Stack

TypeScript, Playwright, Node 20 or newer. TOML via smol-toml.

## Install

```bash
npm install
npx playwright install chromium
npm run walk
```

## License

MIT. See [LICENSE](LICENSE).
