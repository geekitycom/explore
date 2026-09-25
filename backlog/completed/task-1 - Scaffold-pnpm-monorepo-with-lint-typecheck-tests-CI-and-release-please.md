---
id: TASK-1
title: 'Scaffold pnpm monorepo with lint, typecheck, tests, CI, and release-please'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 21:29'
updated_date: '2026-09-24 21:31'
labels: []
milestone: m-0
dependencies: []
documentation:
  - backlog/docs/doc-1 - Architecture.md
priority: high
type: chore
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Lay the tooling every later task depends on: pnpm workspace with packages/core, apps/server, apps/web; shared tsconfig; ESLint flat config; Prettier; Vitest; GitHub Actions CI; release-please manifest config. See doc-1 and decision-8, decision-14.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 pnpm install, lint, format:check, typecheck, test and build all succeed from a clean clone
- [x] #2 CI workflow runs the same commands on push and pull_request
- [x] #3 release-please workflow and manifest config exist for a single root release
- [x] #4 README explains setup and scripts
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Root package.json (private, packageManager pnpm@12.4.2, engines node>=24), pnpm-workspace.yaml (packages/*, apps/*), .nvmrc, .gitignore, .editorconfig.
2. tsconfig.base.json: strict, ES2023, NodeNext-free bundler-style resolution with allowImportingTsExtensions + erasableSyntaxOnly so the server runs on Node type stripping.
3. Package skeletons: packages/core, apps/server, apps/web (Vite) each with typecheck/test scripts and one smoke test.
4. ESLint flat config (typescript-eslint recommendedTypeChecked), Prettier, Vitest workspace projects.
5. GitHub Actions ci.yml (install, lint, format:check, typecheck, test, build) and release-please.yml + release-please-config.json + .release-please-manifest.json (single root node release).
6. README with setup and scripts. Verify all root scripts pass locally.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TypeScript pinned to ~6.0 because typescript-eslint 8.70 requires <6.1 (TS 7 is current). TS 6 defaults types to [], so each package lists its types explicitly. Server runs .ts directly on Node 24 type stripping (erasableSyntaxOnly + allowImportingTsExtensions); verified /api/health responds. CI and release-please could not be run on GitHub because commits stay local per user instruction; the workflow runs the same scripts verified locally.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Scaffolded the pnpm workspace (packages/core, apps/server, apps/web) with strict TS 6, ESLint type-checked rules, Prettier, Vitest projects, CI and release-please workflows, and a README. Verified from a fresh clone: install --frozen-lockfile, lint, format:check, typecheck, test, build all pass.
<!-- SECTION:FINAL_SUMMARY:END -->
