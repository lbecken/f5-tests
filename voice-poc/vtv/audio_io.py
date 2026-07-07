"""Microphone capture and non-blocking speaker playback.

Playback runs on its own thread fed by a queue, so TTS synthesis of
sentence N+1 overlaps with playback of sentence N. The main thread can
block on `wait_until_done()` before re-opening the mic — a cheap way to
avoid the assistant hearing itself (real barge-in needs echo
cancellation; see README extensions).
"""

import queue
import threading

import numpy as np
import sounddevice as sd

from .vad import SAMPLE_RATE, FRAME_SAMPLES


def capture_utterance(segmenter, on_speech_start=None):
    """Block until the VAD segmenter closes one utterance; return float32."""
    frames = queue.Queue()

    def callback(indata, _frames, _time, status):
        frames.put(indata[:, 0].copy())

    started = False
    with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="int16",
                        blocksize=FRAME_SAMPLES, callback=callback):
        while True:
            frame = frames.get()
            if not started and segmenter.in_speech:
                started = True
                if on_speech_start:
                    on_speech_start()
            utterance = segmenter.push(frame)
            if utterance is not None:
                return utterance


class PlaybackQueue:
    """Threaded audio sink: put() int16 chunks, they play in order."""

    def __init__(self, sample_rate, on_first_chunk=None):
        self.q = queue.Queue()
        self.on_first_chunk = on_first_chunk
        self._first_of_turn = True
        self._thread = threading.Thread(
            target=self._run, args=(sample_rate,), daemon=True)
        self._thread.start()

    def _run(self, sample_rate):
        with sd.OutputStream(samplerate=sample_rate, channels=1,
                             dtype="int16") as stream:
            while True:
                chunk = self.q.get()
                try:
                    if chunk is None:  # turn boundary marker
                        self._first_of_turn = True
                        continue
                    if self._first_of_turn:
                        self._first_of_turn = False
                        if self.on_first_chunk:
                            self.on_first_chunk()
                    stream.write(np.ascontiguousarray(chunk))
                finally:
                    self.q.task_done()

    def put(self, chunk):
        self.q.put(chunk)

    def end_turn_and_wait(self):
        """Mark the end of this turn's audio and block until it has played."""
        self.q.put(None)
        self.q.join()
