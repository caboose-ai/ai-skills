# Phone Width Verify

Run a web app locally with throwaway data, sign in, and screenshot pages at
390px wide in light and dark mode. Flags any page that scrolls horizontally.

## Install

```bash
npx skills add caboose-ai/ai-skills@phone-width-verify -g
```

## Use When

- a UI change needs to be seen working, not just tested
- asked to run, screenshot, or check an app on mobile

## Usage

```bash
OUT_DIR=/tmp/shots APP_PASSWORD=dev node scripts/shot.mjs http://localhost:8099 / /settings
```

Requires Playwright (project-local or global). Login fields are configurable
with `LOGIN_PATH`, `PASSWORD_SELECTOR` and `SUBMIT_SELECTOR`; an empty
`APP_PASSWORD` skips login.
