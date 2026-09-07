"""Local speaker enrollment/verification for Tesh.

Uses sherpa-onnx speaker embeddings and stores only the resulting embedding
profile. Raw microphone recordings are not written to disk.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys

import numpy as np
import sounddevice as sd
import sherpa_onnx

RATE = 16000
RECORD_SECONDS = 3.0
SPEAKER_NAME = "primary-user"
THRESHOLD = 0.62


def record() -> np.ndarray:
    print("RECORDING", flush=True)
    samples = sd.rec(int(RATE * RECORD_SECONDS), samplerate=RATE, channels=1, dtype="float32")
    sd.wait()
    return samples[:, 0].astype(np.float32)


def embedding(extractor: sherpa_onnx.SpeakerEmbeddingExtractor, samples: np.ndarray) -> np.ndarray:
    stream = extractor.create_stream()
    stream.accept_waveform(RATE, samples.tolist())
    stream.input_finished()
    if not extractor.is_ready(stream):
        raise RuntimeError("Voice sample is too short for speaker embedding extraction.")
    return np.asarray(extractor.compute(stream), dtype=np.float32)


def normalize(vector: np.ndarray) -> np.ndarray:
    norm = float(np.linalg.norm(vector))
    if norm == 0:
        raise RuntimeError("Empty speaker embedding.")
    return vector / norm


def make_extractor(model: str) -> sherpa_onnx.SpeakerEmbeddingExtractor:
    config = sherpa_onnx.SpeakerEmbeddingExtractorConfig(model=model, num_threads=2, debug=False, provider="cpu")
    return sherpa_onnx.SpeakerEmbeddingExtractor(config)


def enroll(args: argparse.Namespace) -> int:
    extractor = make_extractor(args.model)
    vectors: list[list[float]] = []
    for index in range(args.samples):
        print(f"SAMPLE {index + 1}/{args.samples}: say 'Tesh' naturally, then wait.", flush=True)
        vectors.append(normalize(embedding(extractor, record())).tolist())
    centroid = normalize(np.mean(np.asarray(vectors, dtype=np.float32), axis=0))
    os.makedirs(os.path.dirname(os.path.abspath(args.profile)), exist_ok=True)
    with open(args.profile, "w", encoding="utf-8") as handle:
        json.dump({"version": 1, "speaker": SPEAKER_NAME, "model": os.path.abspath(args.model), "embedding": centroid.tolist(), "threshold": THRESHOLD}, handle)
    print("ENROLLED", flush=True)
    return 0


def verify(args: argparse.Namespace) -> int:
    try:
        with open(args.profile, "r", encoding="utf-8") as handle:
            profile = json.load(handle)
        extractor = make_extractor(args.model)
        candidate = normalize(embedding(extractor, record()))
        reference = normalize(np.asarray(profile["embedding"], dtype=np.float32))
        score = float(np.dot(candidate, reference))
        print(json.dumps({"verified": score >= float(profile.get("threshold", THRESHOLD)), "confidence": max(0.0, min(1.0, (score + 1.0) / 2.0)), "liveness": "UNAVAILABLE"}), flush=True)
        return 0
    except Exception as exc:
        print(f"speaker verification failed: {exc}", file=sys.stderr)
        return 1


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("enroll", "verify"):
        command = sub.add_parser(name)
        command.add_argument("--model", required=True)
        command.add_argument("--profile", required=True)
        if name == "enroll":
            command.add_argument("--samples", type=int, default=3)
    args = parser.parse_args()
    return enroll(args) if args.command == "enroll" else verify(args)


if __name__ == "__main__":
    raise SystemExit(main())
