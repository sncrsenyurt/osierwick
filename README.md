# journey-uptime

Synthetic multi-step uptime monitor. A browser will walk a journey (login, open a dashboard, assert what should be on the page) instead of pinging a single URL.

## Status

Early scaffold. This is day 1: config shape and package metadata only. There is no runner, no alerts, and no CI.

## Planned

- Journeys in YAML: `goto`, `fill`, `click`, `expect`
- Login, then dashboard, then assertions
- Discord and Slack alerts when a step fails
- Screenshots attached to those alerts

None of that is implemented in this commit.

## Stack

Playwright and TypeScript. Node.js 18 or newer.

## Install

```bash
npm install
npm run check
```

`npm run check` is a stub. It prints that the runner is not implemented yet. Dependencies are listed so the toolchain can be installed; nothing executes a journey.

`journeys/example.journey.yaml` shows the config shape we intend to load later. It is a sample and is not wired up.

## License

MIT. See [LICENSE](LICENSE).
