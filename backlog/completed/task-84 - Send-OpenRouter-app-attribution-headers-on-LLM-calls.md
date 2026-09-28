---
id: TASK-84
title: Send OpenRouter app attribution headers on LLM calls
status: Done
assignee:
  - '@claude'
created_date: '2026-09-27 18:05'
updated_date: '2026-09-27 19:05'
labels: []
dependencies: []
references:
  - 'https://openrouter.ai/docs/api-reference/overview'
  - apps/server/src/text-gen.ts
  - apps/server/src/main.ts
priority: low
type: enhancement
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
OpenRouter credits requests to an app when they carry `HTTP-Referer` (the app URL) and `X-Title` (the app name). Credited requests appear under that name in OpenRouter activity logs and public app rankings. The server text generator (`apps/server/src/text-gen.ts`) sends only `content-type` and `authorization`, so explore activity is not credited to it. The client must stay a generic OpenAI-compatible `/chat/completions` client that also works with Ollama and other backends. Attribution should therefore be optional and configured through the environment.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When the app URL and app name are configured, LLM requests send them as `HTTP-Referer` and `X-Title`
- [x] #2 When they are not configured, requests send neither header and behave as they do today
- [x] #3 Either header can be set without the other
- [x] #4 The new env vars are documented in `.env.example` and the README OpenRouter section
- [x] #5 Tests cover requests with and without the headers configured
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add optional appUrl/appName to TextGenSettings; send HTTP-Referer / X-Title only when set.
2. Read them from env in main.ts (LLM_APP_URL, LLM_APP_NAME).
3. Document in .env.example and README OpenRouter section.
4. Tests: with both, with neither, with each alone.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Env vars LLM_APP_URL (HTTP-Referer) and LLM_APP_NAME (X-Title); also documented in deploy/compose.yaml and the README deploy .env block. One test sends four requests (both, neither, each alone) and asserts the received headers; tying X-Title to appUrl fails it. Validation: typecheck, lint, format:check, 1082 unit tests. PR https://github.com/geekitycom/explore/pull/13
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
LLM requests carry HTTP-Referer and X-Title when LLM_APP_URL and LLM_APP_NAME are set, each independently, and neither when unset, so OpenRouter credits explore without affecting other backends. Documented in .env.example, README and compose.yaml. Verified with a text-gen test covering all four combinations plus the full suite. PR #13.
<!-- SECTION:FINAL_SUMMARY:END -->
