"""Local speaker enrollment/verification for Tesh.

Uses sherpa-onnx speaker embeddings and stores only the resulting embedding
profile. Raw recordings are read for processing but are never copied into
the profile.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import av
import numpy as np
import sounddevice as sd
import sherpa_onnx

RATE = 16000
RECORD_SECONDS = 3.0
SPEAKER_NAME = "primary-user"
THRESHOLD = 0.82
MIN_AUDIO_SECONDS = 0.75


def record() -> np.ndarray:
    print("RECORDING", flush=True)
    samples = sd.rec(int(RATE * RECORD_SECONDS), samplerate=RATE, channels=1, dtype="float32")
    sd.wait()
    return samples[:, 0].astype(np.float32)


def load_audio(path: str) -> np.ndarray:
    source = Path(path).expanduser().resolve()
    if not source.is_file():
        raise RuntimeError(f"Audio sample does not exist: {source}")

    try:
        container = av.open(str(source))
    except Exception as exc:
        raise RuntimeError(f"Could not open audio sample '{source.name}': {exc}") from exc

    chunks: list[np.ndarray] = []
    try:
        resampler = av.audio.resampler.AudioResampler(format="flt", layout="mono", rate=RATE)
        for frame in container.decode(audio=0):
            converted = resampler.resample(frame)
            if not isinstance(converted, list):
                converted = [converted]
            for converted_frame in converted:
                if converted_frame is not None:
                    data = converted_frame.to_ndarray()
                    chunks.append(np.asarray(data, dtype=np.float32).reshape(-1))
    finally:
        container.close()

    if not chunks:
        raise RuntimeError(f"No audio stream could be decoded from '{source.name}'.")

    samples = np.concatenate(chunks).astype(np.float32, copy=False)
    if samples.size < int(RATE * MIN_AUDIO_SECONDS):
        raise RuntimeError(f"Audio sample '{source.name}' is too short; use at least {MIN_AUDIO_SECONDS:.2f} seconds.")
    peak = float(np.max(np.abs(samples))) if samples.size else 0.0
    if peak == 0.0:
        raise RuntimeError(f"Audio sample '{source.name}' is silent.")
    samples = samples / max(1.0, peak)
    return samples


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


def sample_audio(path: str | None) -> np.ndarray:
    return load_audio(path) if path else record()


def enroll(args: argparse.Namespace) -> int:
    extractor = make_extractor(args.model)
    paths = args.audio or [None] * args.samples
    vectors: list[list[float]] = []
    for index, path in enumerate(paths):
        label = Path(path).name if path else "microphone"
        print(f"SAMPLE {index + 1}/{len(paths)}: processing {label}.", flush=True)
        vectors.append(normalize(embedding(extractor, sample_audio(path))).tolist())
    centroid = normalize(np.mean(np.asarray(vectors, dtype=np.float32), axis=0))
    profile_path = Path(args.profile).expanduser().resolve()
    profile_path.parent.mkdir(parents=True, exist_ok=True)
    with profile_path.open("w", encoding="utf-8") as handle:
        json.dump({
            "version": 2,
            "speaker": SPEAKER_NAME,
            "model": str(Path(args.model).expanduser().resolve()),
            "embedding": centroid.tolist(),
            "threshold": THRESHOLD,
        }, handle)
    print("ENROLLED", flush=True)
    return 0


def verify(args: argparse.Namespace) -> int:
    try:
        with open(args.profile, "r", encoding="utf-8") as handle:
            profile = json.load(handle)
        expected_model = str(Path(args.model).expanduser().resolve())
        if profile.get("model") != expected_model:
            raise RuntimeError("Speaker profile was enrolled with a different model.")
        extractor = make_extractor(args.model)
        candidate = normalize(embedding(extractor, sample_audio(args.audio[0] if args.audio else None)))
        reference = normalize(np.asarray(profile["embedding"], dtype=np.float32))
        score = float(np.dot(candidate, reference))
        threshold = float(profile.get("threshold", THRESHOLD))
        print(json.dumps({
            "verified": score >= threshold,
            "confidence": max(0.0, min(1.0, score)),
            "liveness": "UNAVAILABLE",
        }), flush=True)
        return 0
    except Exception as exc:
        print(f"speaker verification failed: {exc}", file=sys.stderr)
        return 1


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    enroll_parser = sub.add_parser("enroll")
    enroll_parser.add_argument("--model", required=True)
    enroll_parser.add_argument("--profile", required=True)
    enroll_parser.add_argument("--samples", type=int, default=3)
    enroll_parser.add_argument("--audio", action="append", default=[], help="Existing audio file; repeat for each enrollment sample.")
    verify_parser = sub.add_parser("verify")
    verify_parser.add_argument("--model", required=True)
    verify_parser.add_argument("--profile", required=True)
    verify_parser.add_argument("--audio", action="append", default=[], help="Existing audio file to verify; omit to record from the microphone.")
    args = parser.parse_args()
    if args.command == "enroll" and args.audio and not 1 <= len(args.audio) <= 10:
        parser.error("enroll accepts 1 to 10 --audio files")
    return enroll(args) if args.command == "enroll" else verify(args)


if __name__ == "__main__":
    raise SystemExit(main())
