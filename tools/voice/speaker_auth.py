import argparse
import json
from pathlib import Path

import numpy as np
import sounddevice as sd
import sherpa_onnx

parser = argparse.ArgumentParser()
parser.add_argument('command', choices=['enroll', 'verify'])
parser.add_argument('--model', required=True)
parser.add_argument('--profile', required=True)
parser.add_argument('--samples', type=int, default=1)
parser.add_argument('--seconds', type=float, default=4.0)
parser.add_argument('--threshold', type=float, default=0.55)
parser.add_argument('--prompt', default='')
args = parser.parse_args()

SAMPLE_RATE = 16000


def extractor():
    config = sherpa_onnx.SpeakerEmbeddingExtractorConfig(
        model=args.model,
        num_threads=2,
        debug=False,
        provider='cpu',
    )
    if not config.validate():
        raise RuntimeError('Invalid speaker embedding model configuration.')
    return sherpa_onnx.SpeakerEmbeddingExtractor(config)


def capture(seconds: float) -> np.ndarray:
    frames = max(1, int(seconds * SAMPLE_RATE))
    if args.prompt:
        print(json.dumps({'event': 'prompt', 'text': args.prompt}), flush=True)
    print('SPEAK', flush=True)
    audio = sd.rec(frames, samplerate=SAMPLE_RATE, channels=1, dtype='float32')
    sd.wait()
    samples = np.ascontiguousarray(audio[:, 0])
    rms = float(np.sqrt(np.mean(np.square(samples)) + 1e-12))
    if rms < 0.005:
        raise RuntimeError('No usable speech was captured. Please speak normally and try again.')
    return samples


def embed(samples: np.ndarray, model) -> np.ndarray:
    stream = model.create_stream()
    stream.accept_waveform(sample_rate=SAMPLE_RATE, waveform=samples)
    stream.input_finished()
    if not model.is_ready(stream):
        raise RuntimeError('Audio sample is too short or invalid.')
    return np.asarray(model.compute(stream), dtype=np.float32)


def normalize(vector: np.ndarray) -> np.ndarray:
    norm = float(np.linalg.norm(vector))
    if norm == 0:
        raise RuntimeError('Invalid zero speaker embedding.')
    return vector / norm

model = extractor()
profile_path = Path(args.profile)
profile_path.parent.mkdir(parents=True, exist_ok=True)

if args.command == 'enroll':
    existing: list[np.ndarray] = []
    if profile_path.is_file():
        stored = json.loads(profile_path.read_text(encoding='utf-8'))
        existing = [normalize(np.asarray(item, dtype=np.float32)) for item in stored.get('embeddings', [])]
    for _ in range(max(1, min(10, args.samples))):
        existing.append(embed(capture(args.seconds), model))
    averaged = normalize(np.mean(np.stack(existing), axis=0))
    profile_path.write_text(json.dumps({'version': 1, 'algorithm': 'sherpa-onnx-speaker-embedding', 'sample_count': len(existing), 'embedding': averaged.tolist(), 'embeddings': [normalize(item).tolist() for item in existing]}), encoding='utf-8')
    print(json.dumps({'enrolled': True, 'sample_count': len(existing)}), flush=True)
else:
    if not profile_path.is_file():
        print(json.dumps({'verified': False, 'confidence': 0.0, 'liveness': 'UNAVAILABLE'}), flush=True)
        raise SystemExit(0)
    profile = json.loads(profile_path.read_text(encoding='utf-8'))
    known = normalize(np.asarray(profile['embedding'], dtype=np.float32))
    query = normalize(embed(capture(args.seconds), model))
    similarity = float(np.dot(known, query))
    print(json.dumps({'verified': similarity >= args.threshold, 'confidence': similarity, 'liveness': 'UNAVAILABLE'}), flush=True)
