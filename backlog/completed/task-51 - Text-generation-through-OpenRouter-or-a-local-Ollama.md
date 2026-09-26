---
id: TASK-51
title: Text generation through OpenRouter or a local Ollama
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 22:40'
updated_date: '2026-09-25 23:43'
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
- [x] #1 A server module generates text from a prompt through any OpenAI-compatible chat completions endpoint, configured by base URL, model and API key settings
- [x] #2 The same settings work against OpenRouter and a local Ollama; the README documents both setups
- [x] #3 With no provider configured, or on error or timeout, a call fails fast with a typed result and nothing crashes
- [x] #4 The API key is never sent to the client or written to logs
- [x] #5 Tests cover success, timeout, error and not-configured cases against a fake endpoint, with no network calls in CI
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. apps/server/src/text-gen.ts: createTextGenerator(settings | undefined) returns generate({messages, maxTokens, temperature}) -> TextResult (ok | not-configured | error | timeout), plain fetch to {baseUrl}/chat/completions with AbortSignal.timeout, Bearer key only when set.
2. main.ts parses LLM_BASE_URL, LLM_MODEL, LLM_API_KEY, LLM_TIMEOUT_MS once and logs provider and model (never the key). TASK-52 wires the generator into its caller.
3. Tests against a local node:http fake endpoint: success, timeout, HTTP error, bad body, not-configured, auth header.
4. README: Ollama (gemma3:12b) and OpenRouter setups.
5. Verify once against local Ollama.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Env names: LLM_BASE_URL, LLM_MODEL, LLM_API_KEY, LLM_TIMEOUT_MS. Generation is off unless both base URL and model are set.
main.ts parses the settings and logs model and base URL at startup (verified the key does not appear); it does not build a generator yet because nothing calls it. TASK-52 calls createTextGenerator(textGen) there and passes it to its caller.
Default timeout 15000 ms: a cold gemma3:12b load in Ollama took 8.2 s on the first real call, then 0.9 s warm. Callers must run generation off the screen-generation path and fall back on any non-ok result.
No OpenRouter attribution headers (HTTP-Referer, X-Title) are sent; they are optional.
Validation: pnpm lint, typecheck, test (509 passed), format:check; real call to local Ollama gemma3:12b returned 'The river claimed what the cliff released.'
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added apps/server/src/text-gen.ts: createTextGenerator(settings) returns generateText({messages, maxTokens, temperature}) that POSTs to {baseUrl}/chat/completions with plain fetch and returns ok | not-configured | timeout | error. Settings come from LLM_* env vars parsed in main.ts; the README documents Ollama (gemma3:12b) and OpenRouter (google/gemini-3.8-flash, qwen/qwen3.8-flash). Tests run against a local node:http fake endpoint for success, auth header presence/absence, timeout, HTTP error, malformed/empty bodies, unreachable host and not-configured. Verified for real against local Ollama (8.2 s cold, 0.9 s warm).
<!-- SECTION:FINAL_SUMMARY:END -->
