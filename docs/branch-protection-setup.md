# Branch protection for `main` (Sprint 1 · item #1)

**Why:** a push to `main` triggers an immediate production deploy
(`.github/workflows/deploy.yml` → SSH → `git reset --hard origin/main` →
`scripts/server-deploy.sh`). Without a gate, un-tested code reaches production the
moment it lands on `main`. Branch protection makes CI a hard prerequisite: code can
only reach `main` through a pull request whose CI checks pass — including for
administrators.

**Who must run this:** a repository **admin** of `solusidigitalkita1001-sudo/hris-draft`.
Collaborators with only push access (e.g. the current CI author) get HTTP 403; the
GitHub API rejects branch-protection writes without admin.

## Required status checks

These are the four **blocking** CI jobs (exact context names, copy verbatim):

- `Repo hygiene (filename guard)`
- `Backend (type-check + build [blocking], lint + test [soft])`
- `Frontend (build [blocking], lint [soft])`
- `Migration validation + tests (migrate [blocking], test [soft])`

`Dependency audit (soft)` and `Secret scan (soft)` are advisory (continue-on-error)
and are intentionally **not** required, so they can surface warnings without blocking
a merge.

## Apply via CLI (fastest)

Run as an admin (a token with the `repo` scope and admin on the repo):

```bash
gh api -X PUT repos/solusidigitalkita1001-sudo/hris-draft/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Repo hygiene (filename guard)",
      "Backend (type-check + build [blocking], lint + test [soft])",
      "Frontend (build [blocking], lint [soft])",
      "Migration validation + tests (migrate [blocking], test [soft])"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

What this enforces:

- **`enforce_admins: true`** — even admins cannot bypass; nobody pushes straight to `main`.
- **`required_pull_request_reviews` with 0 approvals** — a PR is required (blocks direct
  pushes) but the author can self-merge once checks pass. Bump
  `required_approving_review_count` to `1` if you want a second-person review before merge.
- **`strict: true`** — a PR branch must be up to date with `main` before it can merge,
  so checks always run against the final merged tree.
- **`allow_force_pushes` / `allow_deletions: false`** — `main` cannot be force-pushed or deleted.

Verify:

```bash
gh api repos/solusidigitalkita1001-sudo/hris-draft/branches/main/protection \
  --jq '{checks:.required_status_checks.contexts, admins:.enforce_admins.enabled}'
```

## Apply via the GitHub UI (alternative)

**Settings → Branches → Add branch ruleset (or classic branch protection rule)** for `main`:

1. **Require a pull request before merging** — approvals `0` (or `1` for peer review).
2. **Require status checks to pass before merging** → enable **Require branches to be up
   to date**, then add the four check names listed above.
3. **Do not allow bypassing the above settings** (this is the UI equivalent of
   `enforce_admins`).
4. Leave **Allow force pushes** and **Allow deletions** off.

## Follow-up (item #2, not covered here)

A safe rollback path (re-deploy a previous known-good commit) touches
`deploy.yml` / `scripts/server-deploy.sh`, which are protected files — do that as a
separate, explicitly-approved change.
