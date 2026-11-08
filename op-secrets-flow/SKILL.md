---
name: op-secrets-flow
description: Use whenever a task needs an API key, token, client secret or password that lives in 1Password (an app's BNET_*, SimpleFIN, Battle.net, registry or provider credential), including creating a Kubernetes Secret, running a CLI against a live API, or wiring a systemd timer. Covers the op CLI session-file flow on a box with no 1Password desktop app, .env.op reference files, op run, and the mistakes that silently create empty secrets. Never read, print, log or paste a secret value.
---

# 1Password secrets flow

## Principle

The agent never holds a secret. `op` resolves references at the moment a
command runs and injects them into that command's environment only. The
agent sees exit codes, lengths and prefixes, never values. Anything that
would put a value in the transcript, a log file, shell history, a chat
message or a repository is wrong, including "just to check it".

## The box

- Only the `op` CLI is installed (no desktop app, no biometric unlock), so a
  session comes from a password prompt the owner answers in their own
  terminal. Sessions idle out after about 30 minutes.
- Items live in the `Personal` vault unless the owner says otherwise.
  Reference form: `op://Personal/<item title>/<field>`. API credentials use
  the `API Credential` category with fields `username` and `credential`.

## Flow 1: the owner opens a session the agent can use

Ask the owner to run, in their own shell:

```bash
op signin --account my --raw > /tmp/claude-1000/op-session; and chmod 600 /tmp/claude-1000/op-session; and set -gx OP_SESSION_my (cat /tmp/claude-1000/op-session)
```

(That is fish syntax; in zsh or bash replace `; and` with `&&` and the
`set -gx` with `export OP_SESSION_my=$(cat ...)`.) The agent then prefixes
its commands with:

```bash
export OP_SESSION_my="$(cat /tmp/claude-1000/op-session)"
```

Check it with `op whoami`. "no active session found" means the session
expired: ask the owner to run the sign-in line again, do not retry.

## Flow 2: a project's `.env.op`

Each project that needs credentials carries a committed `.env.op.example`
and a gitignored `.env.op`:

```
BNET_CLIENT_ID=op://Personal/Battle.net API client/username
BNET_CLIENT_SECRET=op://Personal/Battle.net API client/credential
```

Run anything that needs them through `op run`, from the project directory:

```bash
op run --env-file=.env.op -- ./app discover
```

`op run` masks the values in stdout and stderr as well.

## Flow 3: a Kubernetes Secret, straight from 1Password

```bash
op run --env-file=.env.op -- sh -c 'kubectl -n <ns> create secret generic <name> --from-literal=KEY_A="$KEY_A" --from-literal=KEY_B="$KEY_B"'
```

The single quotes matter: the shell inside `op run` expands the variables,
the outer shell must not. Verify by length, never by value:

```bash
kubectl -n <ns> get secret <name> -o json | python3 -c 'import json,sys,base64; print({k: len(base64.b64decode(v)) for k,v in json.load(sys.stdin)["data"].items()})'
```

A key with length 0 is the empty-secret trap below. Delete and recreate; do
not patch a secret by hand.

## Flow 4: a systemd user timer that needs a token

Systemd units see neither the owner's shell variables nor `op` sessions.
Have the owner write a 0600 env file from the shell that holds the value,
so it never passes through the agent:

```bash
mkdir -p ~/.config/claude; printf 'SOME_TOKEN=%s\n' $SOME_TOKEN > ~/.config/claude/timer.env; chmod 600 ~/.config/claude/timer.env
```

Then in a drop-in for the unit:

```
[Service]
EnvironmentFile=-%h/.config/claude/timer.env
```

Verify inside a transient unit, printing length and a short prefix only:

```bash
systemd-run --user --quiet --wait --pipe --collect -p EnvironmentFile=$HOME/.config/claude/timer.env /bin/sh -c 'printf "len=%s prefix=%s\n" "$(printf %s "$SOME_TOKEN" | wc -c)" "$(printf %s "$SOME_TOKEN" | cut -c1-8)"'
```

## Creating a 1Password item without the value touching history

In fish, `read -s` keeps the value out of history:

```bash
read -s -P 'secret: ' s; and op item create --vault Personal --category "API Credential" --title "<title>" username=<id> credential=$s --tags <tag>; set -e s
```

If a value did land in history, scrub it: `history delete --contains <VARNAME>`
and confirm with `history search --contains <VARNAME>`.

## Traps seen in production

- **Empty secret from a missing env file.** `op run --env-file=.env.op`
  errors when the file is absent; if the owner then runs `touch .env.op` in
  the wrong directory and retries, every variable resolves to empty and the
  command "succeeds". Symptom: the app logs `KEY is required` although the
  secret exists. Always run from the project directory; check
  `ls -l .env.op` is non-empty first; verify lengths afterwards.
- **Expired session mid-task.** `op run` fails with "not currently signed
  in". Hand the owner the sign-in line; never ask for the password.
- **`op item get ... --reveal` to "verify".** Pipe to `wc -c` or `cut -c1-8`
  only. Never into the transcript.
- **A dead key exported in the shell rc.** An `ANTHROPIC_API_KEY` or
  similar exported from `config.fish` reaches every child process, including
  headless agents a plugin spawns, and a revoked key fails them all
  silently. Test suspect keys with a status-only request
  (`curl -s -o /dev/null -w '%{http_code}' ...`) and remove dead exports.

## Guardrails

- Never ask the owner to paste a secret into chat, and never echo one back.
- Never commit `.env.op`, `.env`, `*.db` or a Kubernetes Secret manifest with
  values; `.env.op.example` with `op://` references is the committed artifact.
- Report what you verified (lengths, prefixes, exit codes) and what you did
  not.
