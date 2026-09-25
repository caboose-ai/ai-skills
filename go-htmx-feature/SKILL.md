---
name: go-htmx-feature
description: Use when adding or changing a screen, form, route, or persisted field in a stdlib-only Go + html/template + HTMX app that keeps its data in a single JSON state file (the caboose-ai house layout used by caboose-fit, moto-edit, ff). Covers store schema + migration, handlers, templates, phone-first CSS, tests, and Go pre-push checks.
---

# Go + HTMX Feature

## Principle

These apps are one static Go binary, standard library only, server-rendered
with `html/template` + vendored HTMX, persisting everything to one
`state.json`. They are used one-handed on a phone, often on bad wifi. Every
rule below exists because breaking it lost data, shipped a broken page, or
failed silently on a phone.

## Orient first

Confirm the repo matches the layout, and learn its names, before editing:

```bash
cat go.mod; test ! -e go.sum && echo "stdlib only"
ls cmd internal internal/*/ deploy public 2>/dev/null
grep -n "currentVersion\|type State struct" internal/store/*.go
grep -n "HandleFunc\|Handle(\|Require(" internal/web/routes.go
grep -rn "func newTestServer" internal/web
```

Typical shape: `cmd/<app>` (wiring + Prometheus text), `internal/authsess`
(one password → HMAC cookie), `internal/store` (state file), `internal/web`
(handlers + embedded templates), `public/` (CSS + htmx), `deploy/`. If the
repo differs, follow the repo, not this list. Read its README for roadmap or
design notes and confirm the design with the user before building a feature.

## Workflow

1. **Scope it small.** One PR = one usable slice, or one layer the next slice
   needs (e.g. "store: add X + migration", then "X screen").
2. **Store.**
   - Add domain records as fields on `State`; keep types in the store package.
   - Any shape change bumps `currentVersion` and migrates in `load()`.
     Production holds a real file; a silent shape change on restart is data
     loss. Test the migration from a literal old-version JSON fixture.
   - Once `State` holds slices or maps, `State()` and `Update()` must
     deep-copy. A shallow copy lets readers alias live state and lets a
     failed `Update` leave nested edits behind. Test both.
   - Validate inside the `Update` closure; return an error wrapping a
     sentinel (e.g. `ErrInvalid`) so handlers can tell user error from I/O.
   - Never write the file except through the store's atomic save
     (temp file + fsync + rename).
3. **Routes and handlers.**
   - App routes go behind the auth wrapper. Only health checks, static
     assets and login/logout are public.
   - Go 1.22+ patterns: `"POST /things/{id}/delete"`, `r.PathValue("id")`.
   - POST → 303 → GET on success, so refresh never resubmits.
   - Validation errors re-render the page with the error banner and status
     **200**. Forms are hx-boosted and htmx discards 4xx bodies silently.
   - Expired sessions on an `HX-Request` get 401 + `HX-Redirect`, never a
     302 to the login page (htmx would swap the login form into a fragment).
   - Destructive or positional actions are stale-safe: the form carries the
     ID and the values it was rendered for, and the handler refuses when they
     no longer match. A double-tapped × must not delete the row that slid
     into its place.
   - Render through the buffered render helper so a template error is a 500,
     not half a page with a 200.
   - Nothing metrics-ish on the public mux; metrics get their own port.
4. **Templates.** Reuse the shared `head` / `banner` / `footer` blocks and
   the existing page data struct. POST buttons get `hx-disabled-elt="this"`.
   Asset URLs keep `?v={{.Version}}`. No JavaScript beyond vendored htmx and
   no build step.
5. **CSS.** Tap targets ≥ 44px. Inputs `font-size: 16px` (iOS zooms below).
   `inputmode="decimal"`/`"numeric"` on number fields. Colors are theme
   tokens and pass WCAG AA (4.5:1) in light and dark: compute the ratio, don't
   eyeball it. Pre-fill forms from the last entry where it saves taps.
6. **Tests.** `go test ./...` runs offline. Web tests use the repo's
   `newTestServer` + `httptest`, logging in via `POST /login` and reusing the
   cookie. Pin every phone-specific behaviour with a test: 200-with-banner on
   invalid input, stale delete refused, HX request gets `HX-Redirect`.
7. **Verify in a browser** at phone width (`phone-width-verify`).
8. **Docs.** Update the README shape table, roadmap and status if they changed.

## Pre-push checks

All must be clean before handing off to the PR workflow
(`pre-pr-review-loop`):

```bash
gofmt -l . | grep . && echo "gofmt needed on the files above"
go vet ./...
go test ./...
test ! -e go.sum || echo "go.sum appeared: a dependency was added"
git status --porcelain | grep -E '(^|/)data/|state\.json' && echo "STATE FILE STAGED"
```

## Guardrails

- No new dependencies. If one is truly needed, say why in the PR.
- Never commit `data/` or any `state.json`: it is someone's real records.
- Do not touch the deploy manifest's image line outside a release.
