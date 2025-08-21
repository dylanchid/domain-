# Domain Dash CLI

Domain Dash is a CLI for monitoring domain availability, with per-extension checks, notifications, a scheduler, and optional TUI.

## Install

- Local dev: run in repo
  - npm install
  - node bin/domain- --help

- Global (to use from anywhere):
  - npm install -g .
  - Now you can run `domain-`

Note: Network calls are required for RDAP/WHOIS/DNS checks. If your environment blocks install scripts, install on a machine with internet and copy the built node_modules.

## Usage examples

- Add a domain with extensions:
  - domain- add example -e .com,.net,.io

- List:
  - domain- list

- One-off check (prints per-extension statuses):
  - domain- check

- Watch with notifications off at a 5‑minute interval:
  - domain- watch --no-notifications -i 5

- Export:
  - domain- export -f json -o export.json
  - domain- export -f csv -o export.csv

## Notes and gaps


## Background service

You can now daemonize the watcher from the CLI.

- pm2 (recommended):
  - domain- watch --daemon pm2
  - This uses pm2.ecosystem.config.js if present, otherwise starts the bin directly.
  - It will also run `pm2 save`. Optionally run `pm2 startup` yourself to enable on boot.

- macOS launchd:
  - domain- watch --daemon launchd
  - Prints the steps and paths to create/load a plist at `~/Library/LaunchAgents/com.domain-.cli.plist`.
  - Update node path and repo path if needed, then run `launchctl load`.
## Development

- Run tests: npm test
- Lint/Type: N/A

## License

MIT