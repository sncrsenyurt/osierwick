# osierwick

I keep finding a site is broken only when I try to sign in. The homepage still answers. I want a small program that opens the door, types, presses the button, and checks that a line of text is actually there.

This repo is that idea with the code missing. Early scaffold. No runner, no alerts, no CI.

## What I mean to add

- One TOML file per walk, under `osiers/`
- Playwright to carry out the binds in that file
- A note to Discord or Slack when a bind fails, with a screenshot

None of that is hooked up. `npm run check` says so and exits.

## Stack

TypeScript, Playwright, Node 18 or newer.

## Install

```bash
npm install
npm run check
```

`osiers/porch-light.toml` is a blank sample so I don't forget the field names. Nothing reads it.

## License

MIT. See [LICENSE](LICENSE).
