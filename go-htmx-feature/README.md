# Go + HTMX Feature

Build a feature end to end in a stdlib-only Go + `html/template` + HTMX app
that persists to a single JSON state file: schema version bump and migration,
deep-copied state, phone-safe handlers and templates, tests, and Go pre-push
checks.

## Install

```bash
npx skills add caboose-ai/ai-skills@go-htmx-feature -g
```

## Use When

- adding or changing a screen, form, route, or persisted field
- the app is Go standard library only (no `go.sum`) with HTMX and one
  `state.json`, as in caboose-fit, moto-edit and ff

## What It Enforces

- a schema version bump + migration test for every stored shape change
- validation errors as 200 + banner (htmx drops 4xx), POST → 303 → GET
- stale-safe destructive actions, so a double tap removes one row
- 44px tap targets, 16px inputs, AA contrast in light and dark
- `gofmt`, `go vet`, `go test`, no new dependencies, no state file committed

Pair with `phone-width-verify` to see the change and `pre-pr-review-loop` to
ship it.
