import argparse
import struct
import sys

import numpy as np
from openwakeword.model import Model

parser = argparse.ArgumentParser()
parser.add_argument('--phrase', required=True)
parser.add_argument('--model', default='')
args = parser.parse_args()

model_path = args.model
models = [model_path] if model_path else None
model = Model(wakeword_models=models)
threshold = 0.5

while True:
    header = sys.stdin.buffer.read(8)
    if len(header) != 8:
        break
    sample_rate, byte_count = struct.unpack('<II', header)
    payload = sys.stdin.buffer.read(byte_count)
    if len(payload) != byte_count:
        break
    if sample_rate != 16000:
        continue
    audio = np.frombuffer(payload, dtype=np.float32)
    if audio.size == 0:
        continue
    pcm16 = np.clip(audio, -1.0, 1.0)
    pcm16 = (pcm16 * 32767.0).astype(np.int16)
    prediction = model.predict(pcm16)
    scores = [float(value) for key, value in prediction.items() if args.phrase.lower().replace(' ', '_') in key.lower()]
    if scores and max(scores) >= threshold:
        print('DETECTED', flush=True)
