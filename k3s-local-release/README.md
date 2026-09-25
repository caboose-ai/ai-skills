# k3s Local-Registry Release

Release a single-binary app to a single-node k3s cluster that pulls from a
node-local registry (`localhost:5000`): pick the version, bump the manifest
image line in a PR, back up state before schema changes, build with a
verified version stamp, apply, verify the live site, and roll back.

## Install

```bash
npx skills add caboose-ai/ai-skills@k3s-local-release -g
```

## Use When

- releasing, deploying, bumping the version of, or rolling back an app with
  `deploy/build.sh` and a checked-in k3s manifest

## Notes

Building and applying need the k3s node. From a cloud or sandboxed session
the skill prepares the release PR and hands over the exact node commands
instead of claiming a deploy.
