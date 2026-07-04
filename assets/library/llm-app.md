---
name: llm-app
description: Cross-cutting LLM-application guardrails aligned to the OWASP Top 10 for LLM Applications, independent of SDK (OpenAI, Anthropic, LangChain, LlamaIndex).
appliesTo: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.py"]
stacks: ["llm-app"]
source: original
---

# LLM Application Security

## Hard Constraints (MUST NOT)

- MUST NOT call an LLM provider API key from client-side/browser code — any key shipped to a browser or mobile bundle is extractable and abusable at your expense; proxy LLM calls through a server you control.
- MUST NOT render or execute an LLM's output as trusted content — treat generated text/code/HTML/SQL as untrusted input and sanitize/validate it before rendering as HTML, executing as code, or using it to build a query (OWASP LLM05: Improper Output Handling).
- MUST NOT let a model-invoked tool/function call run with the invoking user's full privileges without a validation/allowlist step — bound what each tool can do (file paths, hosts, destructive operations) so the model can't be steered into unintended actions (OWASP LLM06: Excessive Agency).
- MUST NOT concatenate untrusted external content (web pages, documents, retrieved chunks, user-uploaded files) directly into the same prompt channel as trusted system instructions without a clear delimiter/role separation — this is the vector for indirect prompt injection (OWASP LLM01: Prompt Injection).
- MUST NOT put secrets, internal system details, or another user's data into a system prompt the assistant might be induced to repeat back — system prompts can leak through injection or direct questioning (OWASP LLM07: System Prompt Leakage).
- MUST NOT log full prompts/completions or store them in analytics without considering they may contain PII or secrets a user pasted in — apply the same log-redaction discipline as any other user-input logging path (OWASP LLM02: Sensitive Information Disclosure).
- MUST NOT call an LLM API without a request timeout, an output token cap, and a per-user/session rate limit — unbounded prompt length, output length, or request volume is a cost and availability risk (OWASP LLM10: Unbounded Consumption).

## Ecosystem Idioms & Conventions

- Pin the model version/snapshot you test against (not a rolling "latest" alias) for anything where output stability matters, and re-validate deliberately on upgrade.
- Validate tool-call arguments against the tool's declared schema before executing, the same as validating any other external input.
- Prefer structured output (JSON schema / tool-use response format) over parsing free-form text when the caller needs a machine-readable result.
- Stream responses to the UI for latency-sensitive interactions instead of blocking on the full completion.
- Keep retrieval/embedding pipelines' data sources access-controlled the same as any other data store — a RAG index inherits the sensitivity of what's indexed into it.
