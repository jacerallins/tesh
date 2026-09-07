import argparse
import sys
import threading

import numpy as np
import sounddevice as sd
from openwakeword.model import Model

parser = argparse.ArgumentParser()
parser.add_argument('--phrase', required=True)
parser.add_argument('--model', required=True)
args = parser.parse_args()

SAMPLE_RATE = 16000
model = Model(wakeword_models=[args.model])
stop_event = threading.Event()
last_trigger = 0.0


def callback(indata, frames, time_info, status):
    global last_trigger
    if status:
        print(f'STREAM_STATUS {status}', file=sys.stderr, flush=True)
    pcm = np.asarray(indata[:, 0], dtype=np.float32)
    prediction = model.predict(np.clip(pcm, -1.0, 1.0) * 32767.0)
    score = max((float(value) for value in prediction.values()), default=0.0)
    now = time_info.inputBufferAdcTime if time_info else 0.0
    if score >= 0.5 and now - last_trigger > 2.0:
        last_trigger = now
        print('DETECTED', flush=True)

try:
    print(f'LISTENING {args.phrase}', flush=True)
    with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype='float32', blocksize=1280, callback=callback):
        while not stop_event.wait(0.25):
            pass
except Exception as exc:
    print(f'ENGINE_ERROR {exc}', file=sys.stderr, flush=True)
    raise
