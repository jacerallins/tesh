# Tesh

Tesh is a private personal assistant being built incrementally with Electron, React, TypeScript, Three.js, and SQLite.

## Current architecture

Tesh has a permission-scoped desktop shell, local memory, typed IPC boundaries, tool authorization, diagnostics, companion support, voice interaction, and an AI conversation service.

The voice path is:

```text
wake word → speaker verification → microphone → speech recognition → conversation → AI → TTS
```

### Voice modes

Development can run with clearly labeled mock providers for deterministic UI/testing, or use the real native voice path with `VITE_TESH_NATIVE_VOICE=true`.

The native voice path uses:

- openWakeWord for local wake-word detection from the microphone.
- sherpa-onnx speaker embeddings for local voice enrollment and verification.
- A persistent local voice profile referenced by `TESH_SPEAKER_PROFILE`.

openWakeWord consumes 16 kHz audio frames and supports user-specific/custom verifier models; threshold tuning should be performed against the actual deployment environment. citeturn106502view0

sherpa-onnx exposes speaker embedding extraction and speaker enrollment/search/verification APIs, including Python examples for microphone input. citeturn118514search1turn118514search5

### Activation behavior

When the real native wake-word engine detects the configured wake phrase, Tesh verifies the enrolled speaker. Only after verification does the assistant activate its interface and begin the command-listening session.

Production builds do not substitute development mocks for identity/security controls.

## AI configuration

Tesh supports three runtime modes:

- `auto` (default): use the online provider and fall back to the local provider for provider/network failures.
- `online`: require the online provider.
- `offline`: use only the local OpenAI-compatible provider.

For offline AI, run an OpenAI-compatible local model server and set `TESH_AI_MODE=offline`. The default endpoint is `http://127.0.0.1:11434/v1/chat/completions` with model `llama3.2:3b`.

## Development

```powershell
npm install
npm run dev
```

For native voice development, install the helper dependencies:

```powershell
python -m pip install -r tools/voice/requirements.txt
```

Then configure the native wake-word and speaker model paths in `.env` using `.env.example` as the template. A custom wake-word model for `Tesh Pineapples` must be supplied through `TESH_WAKEWORD_MODEL`; openWakeWord's bundled models are for other phrases. citeturn106502view0

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

The native voice components are kept behind explicit provider boundaries so development can exercise the complete flow without weakening production identity requirements.
