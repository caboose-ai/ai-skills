---
name: phone-width-verify
description: Use when a change to a server-rendered web app needs to be seen working in a real browser at phone width, or when asked to run, screenshot, or visually check an app on mobile. Starts the app locally, signs in if needed, screenshots pages at 390px in light and dark mode, and flags horizontal overflow.
---

# Phone Width Verify

## Principle

Tests prove handlers; they do not prove a phone user can read and tap the
page. Look at it, at phone width, in both color schemes, before calling a UI
change done.

## Workflow

1. **Find how the app runs.** Check, in order: a repo skill or `CLAUDE.md`,
   the README's local-run section, `Makefile`/`package.json` scripts. Use the
   repo's own command and env vars.
2. **Start it in the background with throwaway data.** Put data and the
   binary in a scratch directory, never the repo's data dir, and record the
   PID so you can stop exactly that process. For a Go app:
   ```bash
   SCRATCH=${SCRATCH:-$(mktemp -d)}
   go build -o "$SCRATCH/app" ./cmd/<app>
   <ENV VARS> DATA_DIR="$SCRATCH/data" PORT=8099 "$SCRATCH/app" > "$SCRATCH/server.log" 2>&1 &
   echo $! > "$SCRATCH/app.pid"
   ```
   Poll the health endpoint until it answers, then continue.
3. **Watch for localhost login traps.** A `Secure` session cookie is silently
   dropped over plain HTTP, which looks like a broken login. Use the app's
   dev switch (e.g. `SECURE_COOKIES=0`, an `http://` `BASE_URL`). Required
   secrets that are fatal when unset get a throwaway value
   (`openssl rand -hex 32`).
4. **Screenshot.**
   ```bash
   OUT_DIR="$SCRATCH/shots" APP_PASSWORD=dev \
     node <skill-dir>/scripts/shot.mjs http://localhost:8099 / /some/page
   ```
   The script logs in when `APP_PASSWORD` is non-empty, captures each path at
   390×844 (2× DPR, touch) in light and dark, and prints
   `WARNING: horizontal overflow` for any page wider than the viewport. Set
   `APP_PASSWORD=` (empty) for apps without a login.
5. **Actually look.** Read every PNG. Check: no horizontal scroll, tap
   targets ≥ 44px, inputs not tiny, readable contrast in both schemes, error
   banners visible, version/footer correct.
6. **Interaction flows** (submit a form, double-tap a delete): copy the
   script and drive the page with Playwright's `page.fill` / `page.click`,
   screenshotting after each step.
7. **Clean up.**
   ```bash
   kill "$(cat "$SCRATCH/app.pid")" && rm -rf "$SCRATCH/data" "$SCRATCH/app.pid"
   ```

## Script options

| Env | Default | Meaning |
|---|---|---|
| `OUT_DIR` | `./shots` | where PNGs go; point it outside the repo |
| `APP_PASSWORD` | `dev` | empty skips login |
| `LOGIN_PATH` | `/login` | login page path |
| `PASSWORD_SELECTOR` | `#password` | password field |
| `SUBMIT_SELECTOR` | `button[type=submit]` | login submit button |

Playwright is resolved from the project, then from a global install. If
neither exists, install it (`npm i -g playwright`) and use an existing
Chromium rather than downloading one when the environment provides it.

## Guardrails

- Never `pkill -f <app-name>`: the pattern also matches the shell running it
  and anything with the repo path in its command line. Kill the recorded PID.
- Never write screenshots or scratch data into the repo.
- Report what you saw, including problems, not just that screenshots exist.
