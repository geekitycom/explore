---
id: TASK-51
title: Text generation through OpenRouter or a local Ollama
status: To Do
assignee: []
created_date: '2026-09-25 22:40'
labels: []
milestone: m-5
dependencies: []
priority: medium
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Give the server one small, provider-neutral way to generate short text with a language model, so game content can have a voice: grave epitaphs first, NPC conversations later. It speaks the OpenAI-compatible chat completions API, so the same code reaches OpenRouter in production (for example a Gemini Flash or Qwen Flash model) and a local Ollama in development. Base URL, model and API key come from environment settings parsed once at the config boundary; the key stays on the server and never reaches the client. Generation is optional: with no provider configured, or when a call fails or times out, callers get a clear failure and fall back to their own default, and the game keeps working. It must never slow screen generation, which has a 10 ms budget.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A server module generates text from a prompt through any OpenAI-compatible chat completions endpoint, configured by base URL, model and API key settings
- [ ] #2 The same settings work against OpenRouter and a local Ollama; the README documents both setups
- [ ] #3 With no provider configured, or on error or timeout, a call fails fast with a typed result and nothing crashes
- [ ] #4 The API key is never sent to the client or written to logs
- [ ] #5 Tests cover success, timeout, error and not-configured cases against a fake endpoint, with no network calls in CI
<!-- AC:END -->
