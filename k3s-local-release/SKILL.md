---
name: k3s-local-release
description: Use when releasing, deploying, bumping the version of, or rolling back a single-binary app that ships to a single-node k3s cluster through a node-local registry (localhost:5000) with a deploy/build.sh and a checked-in manifest, as caboose-ai apps do.
---

# k3s Local-Registry Release

## Principle

`main` must always describe what production runs. The manifest's `image:`
line is the source of truth, and a release is not done until the live site
reports the new version.

## Orient first

```bash
ls deploy/
grep -n "image:\|namespace:\|host:\|claimName\|strategy" -A1 deploy/*.yaml
sed -n 1,40p deploy/build.sh
```

From these, note the app name, namespace, registry prefix, public hostname,
health path, and whether the app keeps state on a PVC.

## Where this can run

Building and applying need the k3s node: `docker`, the registry at
`localhost:5000`, and `kubectl`. A cloud or sandboxed agent session has none
of these. There, do steps 1–2 in a PR and hand the user the exact commands
for steps 3–6. Never claim a deploy happened that you did not see.

## Tags and the IfNotPresent trap

Image tags are `vX.Y.Z-caN`: the app version, then a build counter
(`-ca1`, `-ca2`, ...) for rebuilds of the same version. The manifests pull
`IfNotPresent`, so re-pushing an existing tag deploys the node's cached old
image and nothing tells you. Never reuse a tag; bump `N`. Before building,
see what the registry already holds:

```bash
curl -s localhost:5000/v2/<app>/tags/list
```

## Workflow

1. **Pick the version.** Minor per milestone (`v0.N.0`), patch for fixes in
   between. It must be strictly greater than what is running; asset URLs are
   cache-busted with `?v=<version>`, so reusing a number serves stale assets.
   On the node, compare the live image with the manifest:
   ```bash
   kubectl -n <ns> get deploy <app> -o jsonpath='{..image}'
   ```
   If they differ, stop and tell the user: the manifest has drifted.
2. **Bump the manifest in a PR.** Change only the one
   `image: localhost:5000/<app>:vX.Y.Z` line. Keep the `localhost:5000/`
   prefix: a bare tag makes k3s pull from Docker Hub (`ImagePullBackOff`).
   Merge before deploying.
3. **Back up state (schema-bump releases).** An older binary refuses a newer
   state file by design, so image rollback alone cannot undo a migration:
   ```bash
   kubectl -n <ns> exec deploy/<app> -- cat /data/state.json > state-backup-$(date +%F).json
   ```
   Keep it out of every repo.
4. **Build and push** from an up-to-date `main` on the node:
   ```bash
   deploy/build.sh vX.Y.Z
   ```
   It should run tests, build with the version stamp, fail if the binary
   does not report `vX.Y.Z`, push to the local registry, and stage the
   manifest. If `build.sh` lacks the stamp check, flag it.
5. **Apply.**
   ```bash
   kubectl apply -f <staged manifest>
   kubectl -n <ns> rollout status deployment/<app>
   ```
   Prefer `apply` to `kubectl set image`. `set image` never writes back to
   the manifest, so a later `apply` silently rolls production back. With a
   `Recreate` strategy (RWO volume, single writer), expect a few seconds of
   502. First deploy only: create the namespace and the out-of-band secret
   as `build.sh` prints. Secrets never go in the repo.
6. **Verify.**
   - `curl -fsS https://<host>/healthz` returns ok.
   - The footer or version endpoint shows `vX.Y.Z`, not `dev` or the old one.
   - `https://<host>/metrics` is **not** 200 (metrics belong on a private port).
   - After a schema bump, the pod logs show a clean start and the feature's
     main flow works on a phone.
   - Remove any test records you created.

## CronJobs and one-off pods

Batch apps (hourly pollers, nightly backups) ship as a CronJob writing to a
PVC instead of a Deployment. What changes:

- The PVC binds on the first job (`local-path` is WaitForFirstConsumer); a
  `Pending` claim before any job has run is normal.
- There is no rollout to watch. Trigger one run and read it; job names must
  be unique, so count manual runs up:
  ```bash
  kubectl -n <ns> create job --from=cronjob/<name> <name>-manual-1
  kubectl -n <ns> wait --for=condition=complete job/<name>-manual-1 --timeout=600s
  kubectl -n <ns> logs job/<name>-manual-1
  ```
- A job that exits with `KEY is required` while the Secret exists means the
  Secret's values are empty (see the `op-secrets-flow` skill). Delete and
  recreate it; do not patch.
- Read-only commands against the PVC run as a throwaway pod with the same
  image, user and claim (`kubectl run --rm -i --restart=Never` with an
  `--overrides` JSON naming the claim); keep that exact one-liner in the
  app's README so nobody retypes it.
- `concurrencyPolicy: Forbid` only serialises scheduled runs; a manual job
  can overlap one, so the app must tolerate a second writer (SQLite in WAL
  mode with a busy timeout does).

## Rollback

Point the `image:` line back at the previous tag (still in the local
registry), `kubectl apply`, and record it in a PR. If the bad release bumped
the schema, restore the pre-release `state.json` backup as well.

## Guardrails

- Never edit the image line outside a release PR.
- Never deploy from a branch or a dirty tree.
- Never paste secrets into commands you hand the user; reference the secret
  by name.
