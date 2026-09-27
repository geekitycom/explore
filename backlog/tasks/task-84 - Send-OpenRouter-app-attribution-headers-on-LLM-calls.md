---
id: TASK-84
title: Send OpenRouter app attribution headers on LLM calls
status: To Do
assignee: []
created_date: '2026-09-27 18:05'
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
- [ ] #1 When the app URL and app name are configured, LLM requests send them as `HTTP-Referer` and `X-Title`
- [ ] #2 When they are not configured, requests send neither header and behave as they do today
- [ ] #3 Either header can be set without the other
- [ ] #4 The new env vars are documented in `.env.example` and the README OpenRouter section
- [ ] #5 Tests cover requests with and without the headers configured
<!-- AC:END -->
