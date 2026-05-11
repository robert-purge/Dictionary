"""
Test Google TTS with IPA conversion on a broader set of phonetic patterns.
Listen to output before running the full batch.

Usage:
    python scripts/test_google_tts.py
Output: data/tts_google_test/*.mp3
"""

import html, re
from pathlib import Path
from google.cloud import texttospeech

VOICE = "en-US-Neural2-D"
OUT_DIR = Path("data/tts_google_test")
OUT_DIR.mkdir(parents=True, exist_ok=True)

client = texttospeech.TextToSpeechClient()


def to_ipa(raw: str) -> str:
    text = html.unescape(raw)

    # Remove parenthetical notes (?) (mcln: ...) (a)
    text = re.sub(r"\([^)]*\)", "", text)

    # Keep only first variant when separated by ; or /
    text = re.sub(r"\s*[;/]\s*.*", "", text)

    # Strip stray Syriac Unicode
    text = re.sub(r"[܀-ݏ]", "", text)

    # Stress marker before vowel → glottal stop ʔ
    text = re.sub(r"'\s*([aeiouéèâîôû])", r"ʔ\1", text)
    # Stress marker before consonant → IPA primary stress ˈ
    text = re.sub(r"'\s*", "ˈ", text)

    # Long vowels (colon → IPA length mark ː)
    for v in "aeiou":
        text = text.replace(f"{v}:", f"{v}ː")

    # Consonants
    text = text.replace("š", "ʃ")
    text = text.replace("ḥ", "ħ")
    text = text.replace("ṭ", "tˤ")
    text = text.replace("ṣ", "sˤ")
    text = text.replace("ʿ", "ʕ")
    text = text.replace("ʾ", "ʔ")

    # Accented vowels (accent = long)
    text = text.replace("é", "eː")
    text = text.replace("è", "ɛ")
    text = text.replace("â", "aː")
    text = text.replace("î", "iː")
    text = text.replace("ô", "oː")
    text = text.replace("û", "uː")

    # Remove spaces (no gaps in IPA pronunciation string)
    text = text.replace(" ", "")

    return text.strip()


def synthesize(ipa: str) -> bytes:
    synth = texttospeech.SynthesisInput(
        ssml=f"<speak><phoneme alphabet='ipa' ph='{ipa}'>x</phoneme></speak>"
    )
    voice = texttospeech.VoiceSelectionParams(
        language_code="en-US", name=VOICE
    )
    audio_cfg = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3
    )
    resp = client.synthesize_speech(input=synth, voice=voice, audio_config=audio_cfg)
    return resp.audio_content


# Broader sample set covering all major phonetic patterns
SAMPLES = [
    # Basic words
    ("father",    "' aw wa:"),
    ("mother",    "' im ma:"),
    ("house",     "' bé ta:"),
    ("king",      "' ma: lka:"),
    ("water",     "' ma: ia:"),
    ("peace",     "šla: ' ma:"),
    ("abandon",   "' maš lim"),
    ("go",        "' a: zil"),
    # ḥ (pharyngeal h)
    ("one",       "' ḥa: da:"),
    ("life",      "' ḥa ia:"),
    # ṭ (emphatic t)
    ("good",      "' ṭa: wa:"),
    ("child",     "' ṭal ya:"),
    # q (uvular stop)
    ("voice",     "' qa: la:"),
    ("holy",      "' qad di: ša:"),
    # ṣ (emphatic s)
    ("summer",    "' ṣé ṭa:"),
    # Multi-syllable
    ("blessing",  "' brak ta"),
    ("prayer",    "' ṣlo: ta:"),
    ("church",    "' é da:"),
    # With stress mid-word
    ("teacher",   "mal pa: ' na:"),
    ("name",      "' šma:"),
]


import sys
sys.stdout.reconfigure(encoding="utf-8")

for label, raw in SAMPLES:
    ipa = to_ipa(raw)
    audio = synthesize(ipa)
    out = OUT_DIR / f"{label}.mp3"
    out.write_bytes(audio)
    print(f"{label:<14} {raw:<25}  {ipa}")

print(f"\nFiles: {OUT_DIR.resolve()}")
