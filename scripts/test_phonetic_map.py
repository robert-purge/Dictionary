"""
Test phonetic-to-IPA mapping before running full batch.
Converts the dataset's notation to IPA, then passes it to edge-tts via SSML.

Usage:
    python scripts/test_phonetic_map.py
Output: data/tts_map_test/*.mp3
"""

import asyncio, html, re
from pathlib import Path
import edge_tts

VOICE = "en-US-AriaNeural"
RATE  = "-20%"

OUT_DIR = Path("data/tts_map_test")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def to_ipa(raw: str) -> str:
    text = html.unescape(raw)

    # Remove parenthetical notes like (?) (mcln: ...) (a)
    text = re.sub(r"\([^)]*\)", "", text)

    # Keep only first variant when separated by ; or /
    text = re.sub(r"\s*[;/]\s*.*", "", text)

    # Strip stray Syriac Unicode
    text = re.sub(r"[܀-ݏ]", "", text)

    # Stress marker ' before a vowel → glottal stop ʔ
    text = re.sub(r"'\s*([aeiouéèâîôûAEIOU])", r"ʔ\1", text)
    # Stress marker ' before a consonant → IPA primary stress ˈ
    text = re.sub(r"'\s*", "ˈ", text)

    # Long vowels (colon notation → IPA length mark)
    for v in "aeiou":
        text = text.replace(f"{v}:", f"{v}ː")

    # Consonants
    text = text.replace("š", "ʃ")
    text = text.replace("ḥ", "ħ")
    text = text.replace("ṭ", "tˤ")
    text = text.replace("ṣ", "sˤ")
    text = text.replace("ʿ", "ʕ")
    text = text.replace("ʾ", "ʔ")

    # Accented vowels (accent = long/stressed)
    text = text.replace("é", "eː")
    text = text.replace("è", "ɛ")
    text = text.replace("â", "aː")
    text = text.replace("î", "iː")
    text = text.replace("ô", "oː")
    text = text.replace("û", "uː")

    # Remove spaces (IPA has no syllable-space gaps in a single word)
    text = text.replace(" ", "")

    return text.strip()


def ssml(ipa: str) -> str:
    """Wrap IPA in SSML phoneme tag so the TTS engine reads it as IPA."""
    return (
        "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' "
        "xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'>"
        f"<phoneme alphabet='ipa' ph='{ipa}'>x</phoneme>"
        "</speak>"
    )


# Same samples as test_tts.py
SAMPLES = [
    ("aaron",   "a:h ' ru:n"),
    ("father",  "' aw wa:"),
    ("mother",  "' im ma:"),
    ("house",   "' bé ta:"),
    ("abandon", "' maš lim"),
    ("king",    "' ma: lka:"),
    ("water",   "' ma: ia:"),
    ("go",      "' a: zil"),
    ("peace",   "šla: ' ma:"),
    ("israel",  "is ' &#7789;i: ra"),
]


async def main():
    for label, raw in SAMPLES:
        ipa = to_ipa(raw)
        markup = ssml(ipa)

        out = OUT_DIR / f"{label}.mp3"
        communicate = edge_tts.Communicate(text=markup, voice=VOICE, rate=RATE)
        await communicate.save(str(out))

        print(f"{label:<12} {raw}  ->  {ipa}")

    print(f"\nFiles: {OUT_DIR.resolve()}")


asyncio.run(main())
