"""Utterance endpointing with WebRTC VAD.

Endpointing = deciding *when the user has finished speaking*. This is the
first latency lever in a voice pipeline: the pipeline cannot start thinking
until it decides your sentence is over. We use a small silence timeout
(default 500 ms) — short enough to feel snappy, long enough not to cut you
off mid-sentence between words.

A ring buffer keeps a little audio from *before* speech was detected, so
the first syllable isn't clipped off the transcription.
"""

import collections

import numpy as np
import webrtcvad

SAMPLE_RATE = 16_000          # what both webrtcvad and whisper want
FRAME_MS = 30                 # webrtcvad accepts 10/20/30 ms frames
FRAME_SAMPLES = SAMPLE_RATE * FRAME_MS // 1000


class UtteranceSegmenter:
    """Feed 30 ms int16 frames; get back one complete utterance."""

    def __init__(self, aggressiveness=2, silence_ms=500, padding_ms=300,
                 min_speech_ms=250):
        self.vad = webrtcvad.Vad(aggressiveness)
        self.silence_frames = max(1, silence_ms // FRAME_MS)
        self.min_speech_frames = max(1, min_speech_ms // FRAME_MS)
        self.pre_buffer = collections.deque(maxlen=max(1, padding_ms // FRAME_MS))
        self.reset()

    def reset(self):
        self.pre_buffer.clear()
        self.voiced = []
        self.in_speech = False
        self.trailing_silence = 0
        self.speech_frames = 0

    def push(self, frame_int16: np.ndarray):
        """Process one frame. Returns the full utterance as float32 in
        [-1, 1] once the trailing-silence threshold is hit, else None."""
        is_speech = self.vad.is_speech(frame_int16.tobytes(), SAMPLE_RATE)

        if not self.in_speech:
            self.pre_buffer.append(frame_int16)
            if is_speech:
                self.in_speech = True
                self.voiced = list(self.pre_buffer)
                self.speech_frames = 1
                self.trailing_silence = 0
            return None

        self.voiced.append(frame_int16)
        if is_speech:
            self.speech_frames += 1
            self.trailing_silence = 0
            return None

        self.trailing_silence += 1
        if self.trailing_silence < self.silence_frames:
            return None

        # End of utterance. Discard blips too short to be real speech.
        utterance = None
        if self.speech_frames >= self.min_speech_frames:
            pcm = np.concatenate(self.voiced)
            utterance = pcm.astype(np.float32) / 32768.0
        self.reset()
        return utterance
