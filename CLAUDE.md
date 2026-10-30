# CLAUDE.md

This repo builds joylynnwanjiru.com. **`BUILD_BRIEF.md` is the single source of truth.** Read it fully at the start of every session before doing anything. If this file and the brief ever disagree, the brief wins; flag the conflict to Joylynn.

## How we work

- Build **one phase at a time**, in the order of brief section 9. Do not start the next phase until Joylynn approves the phase report for the current one.
- Within a phase, keep building without asking for a go-ahead on each step, as long as the work fits the brief and nothing conflicts (Joylynn, 30 October 2026). Share the plan, then proceed. Still stop for **ASK JOYLYNN** items, new dependencies (rule 3), destructive git operations and real conflicts.
- **VERIFY** in the brief: check the current official docs first, tell Joylynn what you found, then rely on it.
- **ASK JOYLYNN** in the brief: stop and ask. Never guess the answer.
- End every phase with a phase report: what was built, the definition of done item by item (pass/fail with evidence, including Lighthouse scores), VERIFY findings and decisions, open `TODO(joylynn)` items, and what Joylynn must provide next.

## Git: Claude runs it

- **Run git and `gh` commands yourself** (add, commit, branch, checkout, push, pull, merge, PRs). After each step, tell Joylynn what you ran and the commit message used.
- **Merge pull requests yourself** once the build and checks pass (Joylynn approved this on 29 October 2026). Report each merge.
- **Ask first before anything destructive or hard to undo:** force-push, `reset --hard`, rewriting history, deleting branches, creating or deleting repos. Explain what it does and wait for her to confirm.
- No attribution lines (Co-Authored-By, "Generated with") in commit messages or pull requests.
- The GitHub repo is `JoylynnWanjiru/Joylynnwanjiru.com` (private).

## Working rules (brief section 0, repeated here)

1. **Never invent facts.** No made-up metrics, clients, testimonials, dates, quotes or job titles. Missing content gets a visible placeholder marked `TODO(joylynn): <what is needed>`.
2. **Launch blockers are enforced in code.** `pnpm check:launch` fails if any `TODO(joylynn)` remains in a field marked as a launch blocker (brief section 10). It runs in CI on `main`.
3. **Ask before adding a dependency** that is not listed in brief section 2.
4. **One task, one branch, one pull request.** Branch names: `feature/…`, `fix/…`, `chore/…`. Keep `main` deployable. Small, clearly described commits.
5. **Keep the README true.** It describes only what is actually in the repo.
6. **Reference project:** lewis-kori/astro-portfolio-v3 (MIT). Learn patterns from it. If substantial code is copied, keep its MIT notice in `THIRD_PARTY_NOTICES.md`. Never copy its content, copy, images or brand colours.
7. **Performance is a requirement, not a polish step.** Every phase ends with the brief section 7 budget passing (Lighthouse 95+ mobile in all four categories, LCP < 2.0 s, CLS < 0.05, < 50 KB JS on content pages).

## Also always

- Never hard-code prices (`$77`, `$500`, `60%`); read them from site settings (BR-7).
- Images go through `astro:assets` from `src/assets`; nothing in `public/` except favicons, crawler files and the manifest.
- Secrets only via `astro:env` and Cloudflare environment variables; `.env.example` lists names, never values.
- Hosting is Cloudflare. Do not use Vercel Hobby (commercial use is not allowed).
- Run build, type check, lint and tests as you go; report failures honestly with output.
- Package manager: `pnpm`. Node: current LTS (24).

## Environment notes (from the Phase 1 spike)

- `astro dev` runs on Node without the Cloudflare adapter, because Keystatic local mode refuses to run in workerd. `astro build` and `astro preview` use the adapter.
- This machine has about 8 GB RAM: never run a build while a dev or preview server is running.
- Keystatic GitHub mode works on Cloudflare (no fallback needed). Its three secrets (`KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET`) are read at runtime via `getSecret` and are stored on the Worker. `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` is inlined at build time, so it is a Workers Builds build variable.
- Cloudflare Workers Builds is connected: `main` deploys to production, other branches deploy a preview at `https://<branch>-joylynnwanjiru.joylynnwanjiru-com.workers.dev`. Previews have their own secrets, so sign in to `/keystatic` on the production workers.dev URL, not on previews.
- Keystatic opens on `main`; switch branch in its top-left menu to edit another branch. Its commits are titled "Update <path>", not our `chore:`/`fix:` style.
- `packageManager` in `package.json` pins pnpm; without it Workers Builds uses an old pnpm that rejects our settings-only `pnpm-workspace.yaml`. Bump it and the lockfile together.
- The build copies `.env` into `dist/server/.dev.vars`. It is not uploaded on deploy (checked with a dry run), and `dist/` is gitignored.
- GitHub App redirect URIs: `127.0.0.1:4321` for local and the workers.dev URL. Add the real domain's callback when it goes live.
- Branch protection is not available on a free account with a private repo; brief 12.5 assumes `main` is protected (open decision for Joylynn).
