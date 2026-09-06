# Commit Message Convention

This repo enforces [Conventional Commits](https://www.conventionalcommits.org/) with a
`commit-msg` git hook. A commit whose **subject line** does not match the format is
rejected before it is created.

## One-time setup (every clone)

Git does not track `.git/hooks/`, so each developer must point Git at the committed
hooks folder once after cloning:

```bash
# macOS / Linux / Git Bash
sh scripts/setup-hooks.sh
```

```bat
:: Windows CMD / PowerShell
scripts\setup-hooks.bat
```

Both just run `git config core.hooksPath .githooks`. Verify with:

```bash
git config core.hooksPath   # should print: .githooks
```

If you skip this, your commits are never validated — and CI or a reviewer will catch
the bad message later instead.

## The format

```
type(scope): description
```

| Part | Required | Rules |
| --- | --- | --- |
| `type` | yes | lowercase, one of the allowed types below |
| `(scope)` | no | in parentheses; letters, digits, `_`, `-`, `/` |
| `!` | no | placed right before the colon to flag a breaking change |
| `: ` | yes | a colon **followed by a space** |
| `description` | yes | short, imperative, lowercase, no trailing period |

Only the first line is checked. Body and footer are free-form.

### Allowed types

| Type | Use for |
| --- | --- |
| `feat` | a new user-facing feature |
| `fix` | a bug fix |
| `refactor` | code change that neither fixes a bug nor adds a feature |
| `perf` | a change that improves performance |
| `test` | adding or correcting tests |
| `docs` | documentation only |
| `style` | formatting, whitespace, semicolons — no logic change |
| `build` | build system, bundler, or dependency changes |
| `ci` | CI configuration and pipeline scripts |
| `chore` | housekeeping that fits nothing above |
| `revert` | reverts a previous commit |

### Common scopes

`auth`, `api`, `ui`, `backend`, `frontend`, `database`, `service`, `config`,
`deploy`, `build`, `docs`, `tests`

Scope is optional — omit it when a change is repo-wide.

## Examples

### Valid

```bash
git commit -m "feat(auth): add jwt refresh token rotation"
git commit -m "fix(api): handle missing request parameters"
git commit -m "refactor(frontend): extract map marker into its own component"
git commit -m "docs: update installation guide"
git commit -m "chore: bump dependencies"
git commit -m "feat(api)!: drop v1 login endpoint"
```

### Rejected

```bash
git commit -m "updated login"           # no type
git commit -m "feat:add login"          # missing space after the colon
git commit -m "Feat(auth): add login"   # type must be lowercase
git commit -m "feature(auth): login"    # 'feature' is not an allowed type
git commit -m "feat(auth):"             # description is empty
```

## Multi-line messages

Repeat `-m`; each one becomes a paragraph. Only the first is validated.

```bash
git commit -m "feat(auth): add persisted session store" \
           -m "Uses zustand with localStorage so a refresh keeps the user signed in." \
           -m "Closes #12"
```

For a breaking change, either add `!` before the colon or add a footer:

```bash
git commit -m "feat(api)!: return ISO timestamps from /trips" \
           -m "BREAKING CHANGE: clients parsing epoch millis must be updated."
```

## When a commit is rejected

Your message is not lost — Git keeps it in `.git/COMMIT_EDITMSG`. Reopen and fix it:

```bash
git commit -e -F .git/COMMIT_EDITMSG
```

## Exemptions

The hook lets these through untouched:

- merge commits (`Merge branch`, `Merge pull request`, `Merge tag`)
- `git commit --fixup=<sha>` and `--squash=<sha>` (`fixup!` / `squash!` messages)

## Escape hatch

`git commit --no-verify` skips the hook. Use it only for a genuine emergency — not to
get past a message you can simply rewrite.
