# op-secrets-flow

Claude Code skill for moving secrets from 1Password into commands,
Kubernetes Secrets and systemd timers through the `op` CLI without the agent
ever seeing a value. Written from the gobbo deploy on 2026-11-08, where an
empty `.env.op` produced a Kubernetes Secret with two zero-byte values.

Install:

```bash
claude plugin install op-secrets-flow@caboose-ai-skills
```
