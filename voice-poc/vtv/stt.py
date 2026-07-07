"""Speech-to-text with faster-whisper.

faster-whisper is Whisper re-implemented on CTranslate2: ~4x faster than
openai/whisper on CPU with int8 quantization, same accuracy. For a live
pipeline we tune everything for speed:

- small model ("base.en" by default) — an utterance of a few seconds
  transcribes in a few hundred ms on a laptop CPU
- beam_size=1 (greedy) — beam search buys little accuracy here and costs
  real time
- no internal VAD pass — our segmenter already trimmed the audio
"""

from faster_whisper import WhisperModel


class Transcriber:
    def __init__(self, model_name="base.en", device="cpu", compute_type="int8"):
        self.model = WhisperModel(model_name, device=device,
                                  compute_type=compute_type)
        self.language = "en" if model_name.endswith(".en") else None

    def transcribe(self, audio_f32) -> str:
        """audio_f32: float32 mono at 16 kHz, range [-1, 1]."""
        segments, _info = self.model.transcribe(
            audio_f32,
            language=self.language,
            beam_size=1,
            vad_filter=False,
            condition_on_previous_text=False,
        )
        return " ".join(s.text.strip() for s in segments).strip()
