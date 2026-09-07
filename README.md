# Tesh

Tesh is a private personal assistant being built incrementally with Electron, React, TypeScript, Three.js, and SQLite.

## Current architecture

Tesh has a permission-scoped desktop shell, local memory, typed IPC boundaries, tool authorization, diagnostics, companion support, voice interaction, and an AI conversation service.

The voice path is structured as:

```text
wake word → speaker verification → microphone → speech recognition → conversation → AI → TTS
```

Development builds may use clearly labeled mock wake-word and speaker-verification providers. Production builds use fail-closed provider boundaries and do not claim identity verification when a real biometric provider is unavailable.

The AI path supports three runtime modes:

- `auto` (default): use the configured online provider and fall back to the local provider when the online provider is unavailable, times out, or is rate limited.
- `online`: require the configured online provider.
- `offline`: use only the local OpenAI-compatible provider.

## Development

```powershell
npm install
npm run dev
```

## AI configuration

Copy `.env.example` to `.env` for local configuration.

For online AI, set `TESH_AI_API_KEY` and optionally `TESH_AI_MODEL` / `TESH_AI_ENDPOINT`.

For offline AI, run an OpenAI-compatible local model server and set `TESH_AI_MODE=offline`. The default local endpoint is `http://127.0.0.1:11434/v1/chat/completions` and the default model is `llama3.2:3b`.

For automatic online/offline behavior, keep `TESH_AI_MODE=auto`. A local server is then used as a fallback when the online provider cannot complete the request.

## Validation

```powershell
npm run typecheck
npm test -- --run
npm run build
npm start
```

## Windows packaging

```powershell
npm run package:win
```

The current release line intentionally keeps production speaker verification and production wake-word detection behind explicit provider implementations rather than shipping development mocks as security controls.
