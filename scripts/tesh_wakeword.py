"""Local Tesh wake-word listener.

The custom model must be trained for the word/phrase "Tesh" and supplied with
TESH_WAKEWORD_MODEL. Audio never leaves the machine: the model consumes the
microphone stream locally and prints DETECTED on activation.
"""
from __future__ import annotations

import argparse
import sys
import time

import numpy as np
import pyaudio
from openwakeword.model import Model


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--phrase", default="Tesh")
    parser.add_argument("--model", required=True)
    parser.add_argument("--threshold", type=float, default=0.55)
    parser.add_argument("--vad-threshold", type=float, default=0.5)
    parser.add_argument("--cooldown", type=float, default=1.5)
    args = parser.parse_args()

    if args.phrase.strip().lower() != "tesh":
        print("This listener is configured for the Tesh wake word.", file=sys.stderr)

    model = Model(
        wakeword_models=[args.model],
        inference_framework="onnx",
        vad_threshold=args.vad_threshold,
    )

    audio = pyaudio.PyAudio()
    stream = audio.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=16000,
        input=True,
        frames_per_buffer=1280,
    )
    last_detected = 0.0

    try:
        while True:
            raw = stream.read(1280, exception_on_overflow=False)
            frame = np.frombuffer(raw, dtype=np.int16)
            scores = model.predict(frame)
            now = time.monotonic()
            if now - last_detected < args.cooldown:
                continue
            if any(float(score) >= args.threshold for score in scores.values()):
                last_detected = now
                print("DETECTED", flush=True)
                model.reset()
    except KeyboardInterrupt:
        return 0
    finally:
        stream.stop_stream()
        stream.close()
        audio.terminate()


if __name__ == "__main__":
    raise SystemExit(main())
