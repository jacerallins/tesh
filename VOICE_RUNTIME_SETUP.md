# Tesh voice runtime setup

## Wake word

The desktop app uses the local `scripts/tesh_wakeword.py` listener when a custom Tesh ONNX model is installed.

Default model location on Windows:

`%APPDATA%/Tesh/models/tesh-wakeword.onnx`

Override with `TESH_WAKEWORD_MODEL` if you want another location.

The runtime expects a custom OpenWakeWord ONNX model whose target phrase is **Tesh**. The two supplied recordings are prepared as 16 kHz, mono, signed-16 WAV files for use as real positive clips during model training. They are not themselves a wake-word model.

## Speaker verification

The desktop app uses `scripts/tesh_speaker.py` with a local Sherpa-ONNX speaker embedding model.

Default model location:

`%APPDATA%/Tesh/models/speaker.onnx`

Default identity profile:

`%APPDATA%/Tesh/voice/primary-speaker.json`

Override with `TESH_SPEAKER_MODEL` and `TESH_SPEAKER_PROFILE` when needed.

The identity profile contains the averaged speaker embedding and metadata; raw enrollment recordings are not written by the Tesh speaker script.

Enrollment records 3-10 microphone samples locally. Verification records a fresh local sample and compares its normalized embedding to the enrolled profile.

## Runtime requirements

Install the Python dependencies from `scripts/requirements.txt` into the Python environment selected by `TESH_SPEAKER_PYTHON` / `TESH_WAKEWORD_PYTHON` (both default to `python`).

The wake-word and speaker model files are intentionally external runtime assets and are not committed to the source repository.

## Production gate

Do not mark voice identity production-ready until:

- the Tesh ONNX wake-word model exists and passes real-device false-positive/recall testing;
- the speaker embedding model exists and passes same-speaker and different-speaker testing;
- liveness is explicitly implemented if biometric anti-spoofing is required.
