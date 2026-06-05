# Agent Instructions

Eden is a full-stack AI-first requirements platform: NestJS API + React SPA + PostgreSQL + Eden CLI + 16 Eve Horizon agents. See [ARCHITECTURE.md](ARCHITECTURE.md) for system diagrams.

## Project Context

- **API**: `apps/api/` — NestJS 11, 20 domain modules, PostgreSQL with RLS (19 tables)
- **Web**: `apps/web/` — React 18, Vite, Tailwind, 9 project pages + login
- **CLI**: `cli/` — 22 command modules wrapping every REST endpoint
- **Agents**: `eve/agents.yaml` + `skills/` — 16 agents (coordinator, 7 experts, 8 intelligence/wizard)
- **Database**: `db/migrations/` — 8 migrations, never edit existing migrations
- **Config**: `.eve/manifest.yaml` — deployment, pipelines, managed Postgres

## API Access Policy for Agents

- All agent documentation, runbooks, and skill workflows that touch Eden API data MUST call the `eden` CLI.
- Never call Eden REST endpoints directly from skills or agent workflows (`curl`, `fetch`, or manual URLs).
- Use `eden` (not `./cli/bin/eden`) so path handling remains stable across directories.
- If an agent needs an API operation the CLI does not expose, add the command in CLI first, then update skills.
- CLI/API parity is mandatory for every non-webhook REST operation. When adding, changing, or removing a public Eden API route, update the `eden` CLI in the same change and keep docs/tests aligned so agents never need a raw REST fallback.

## Skill Authoring Rules

- **Inline templates only.** Agent SKILL.md files must keep critical structural templates (JSON schemas for changesets, entity shapes) inline in the prompt. Never move them to reference files — agents either skip reading them or read wrong files, resulting in malformed output (missing `display_reference`, `acceptance_criteria`, etc.).
- **Shared references** are fine for non-critical context in `skills/_references/`, but anything the agent must produce in a specific shape belongs inline in the SKILL.md.

## Changeset Contract Validation

When modifying changeset-related code (contracts, changeset service, skills that create changesets):
1. Run `./scripts/check-contract-drift.sh` to verify the contract JSON is in sync with the Zod schema
2. If the contract shape changes, regenerate with `npm run generate:contracts --prefix apps/api`
3. Update inline templates in affected SKILL.md files to match the new shape

## CRITICAL: Staging Deployment

**You MUST sync the manifest before every deploy.** Failure to do so causes "Manifest missing services" errors because the platform uses a stale server-side manifest for routing.

**Deploy checklist:**
```bash
# 1. Commit and push your code changes
git add <files> && git commit -m "..." && git push

# 2. Deploy (--repo-dir . syncs the manifest automatically)
eve env deploy sandbox --ref HEAD --repo-dir .
```

**NEVER run `eve env deploy` without `--repo-dir .`** — without it, the CLI uses whatever manifest was last synced to the server, which may be stale, corrupted, or from a different session. This is the #1 cause of deploy failures in this project.

**If deploy fails:**
1. Run `eve project sync` to force-sync the manifest
2. Retry: `eve env deploy sandbox --ref HEAD --repo-dir .`
3. If still failing, check `eve build diagnose <build_id>` for the specific error

**Verify after deploy:**
```bash
curl -sI https://eden.eh1.incept5.dev       # Should return 200
curl -sI https://api.incept5-eden-sandbox.eh1.incept5.dev/health  # API health
```

## Issue Tracking

This project uses **bd** (beads) for ALL issue tracking. Run `bd onboard` to get started.

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** — Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) — Tests, linters, builds
3. **Update issue status** — Close finished work, update in-progress items
4. **PUSH TO REMOTE** — This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** — Clear stashes, prune remote branches
6. **Verify** — All changes committed AND pushed
7. **Hand off** — Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing — that leaves work stranded locally
- NEVER say "ready to push when you are" — YOU must push
- If push fails, resolve and retry until it succeeds

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:970c3bf2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   bd dolt push
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

<!-- BEGIN BEADS CODEX SETUP: generated by bd setup codex -->
## Beads Issue Tracker

Use Beads (`bd`) for durable task tracking in repositories that include it. Use the `beads` skill at `.agents/skills/beads/SKILL.md` (project install) or `~/.agents/skills/beads/SKILL.md` (global install) for Beads workflow guidance, then use the `bd` CLI for issue operations.

### Quick Reference

```bash
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --claim  # Claim work
bd close <id>           # Complete work
bd prime                # Refresh Beads context
```

### Rules

- Use `bd` for all task tracking; do not create markdown TODO lists.
- Run `bd prime` when Beads context is missing or stale. Codex 0.129.0+ can load Beads context automatically through native hooks; use `/hooks` to inspect or toggle them.
- Keep persistent project memory in Beads via `bd remember`; do not create ad hoc memory files.

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.
<!-- END BEADS CODEX SETUP -->
