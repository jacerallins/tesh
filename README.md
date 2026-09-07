# Tesh

Tesh is a private personal assistant being built incrementally with Electron, React, TypeScript, Three.js, and SQLite.

## Current architecture

Tesh has a permission-scoped desktop shell, local memory, typed IPC boundaries, tool authorization, diagnostics, companion support, voice interaction, and an AI conversation service.

The real-app voice path is:

```text
local microphone → wake word "Tesh" → speaker verification → verified session → Tesh interface → speech recognition → conversation → AI → TTS
```

### Voice modes

Development can run with clearly labeled mock providers for deterministic UI/testing, or use the real native voice path with `VITE_TESH_NATIVE_VOICE=true`. Production selects the native path and fails closed if required native components are unavailable.

The native voice path uses:

- openWakeWord for local wake-word detection from the microphone.
- sherpa-onnx speaker embeddings for local voice enrollment and verification.
- A persistent local voice profile referenced by `TESH_SPEAKER_PROFILE`.

openWakeWord consumes 16 kHz PCM audio frames for streaming wake-word inference, and custom wake-word models can be supplied by path. citeturn805889search1turn805889search0

sherpa-onnx exposes speaker embedding extraction plus enrollment/search/verification through its speaker embedding APIs. citeturn484791search0turn484791search1

### Activation behavior

The configured wake word is **Tesh**. A wake event does not immediately reveal the interface: Tesh first checks the enrolled speaker profile. Only a successful verification creates a verified session and reveals the assistant interface. The same flow is used by development-native testing and production.

The wake-word model itself must be trained for the word `Tesh`. The app does not pretend a bundled model for another phrase is equivalent. Speaker verification is the second security gate and ties activation to the enrolled primary user.

## Native voice setup

Install the local helper dependencies:

```powershell
python -m pip install -r scripts/requirements.txt
```

Configure the native paths using `.env.example`:

```text
VITE_TESH_WAKE_PHRASE=Tesh
TESH_WAKEWORD_SCRIPT=scripts/tesh_wakeword.py
TESH_WAKEWORD_MODEL=C:\path\to\tesh.onnx
TESH_SPEAKER_SCRIPT=scripts/tesh_speaker.py
TESH_SPEAKER_MODEL=C:\path\to\3dspeaker_speech_campplus_sv_zh-cn_16k-common.onnx
TESH_SPEAKER_PROFILE=%LOCALAPPDATA%\Tesh\voice\primary-user.json
```

During first-run setup, **Enroll my voice** calls the native enrollment implementation. The native speaker helper records the enrollment samples and stores the derived speaker embedding profile rather than permanent raw recordings. Future verification records a short sample, computes an embedding, and compares it against the enrolled profile locally.

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

Development builds retain deterministic panels for memory, permissions, voice, identity, system tools, AI, communications, diagnostics, and companion behavior. Native voice can be exercised locally by enabling `VITE_TESH_NATIVE_VOICE=true` and configuring the native models/scripts.

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

Production does not substitute development mocks for identity or wake-word security.
