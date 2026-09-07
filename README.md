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

### Activation behavior

The configured wake word is **Tesh**. A wake event does not reveal the interface immediately. Tesh first verifies the current speaker against the enrolled primary-user profile. Only a successful verification creates a verified session and reveals the assistant interface.

### Siri-style voice enrollment

During first-run setup, the native build presents **Teach Tesh your voice**. Tesh displays a short phrase, asks you to read it aloud, records that enrollment sample locally, and moves to the next phrase. After several different phrases, Tesh builds the local speaker profile. The setup cannot finish the native voice setup step until enrollment is complete.

The same enrollment option is available later in Settings → Voice & Wake so the primary voice can be re-enrolled or cleared.

The wake word and speaker identity are separate: the wake word is always **Tesh**, while the enrolled voice determines whether Tesh should respond to that wake word.

The wake-word model itself must be trained for the word `Tesh`; the app does not pretend a model for another phrase is equivalent.

## Native voice setup

Install the local helper dependencies:

```powershell
python -m pip install -r tools/voice/requirements.txt
```

Configure the native paths using `.env.example`:

```text
VITE_TESH_NATIVE_VOICE=true
VITE_TESH_WAKE_PHRASE=Tesh
TESH_WAKEWORD_SCRIPT=tools/voice/openwakeword_bridge.py
TESH_WAKEWORD_MODEL=C:\path\to\tesh.onnx
TESH_SPEAKER_SCRIPT=tools/voice/speaker_auth.py
TESH_SPEAKER_MODEL=C:\path\to\speaker-embedding-model.onnx
TESH_SPEAKER_PROFILE=%LOCALAPPDATA%\Tesh\voice\primary-user.json
```

During first-run setup, each enrollment phrase is sent to the native speaker helper as a one-sample enrollment action. The helper stores derived speaker embeddings rather than permanent raw recordings. Future verification captures a short sample, computes an embedding, and compares it against the enrolled profile locally.

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
