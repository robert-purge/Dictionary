"""
Quick TTS test — generates a few sample MP3s to evaluate voice quality.
Listen to the output files before committing to full batch generation.

Usage:
    set OPENAI_API_KEY=your-key
    python scripts/test_tts.py
"""

import os
from pathlib import Path
import openai

client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])

# Sample phonetics from the dataset — mix of simple and complex
SAMPLES = [
    ("aaron",    "a:h ' ru:n"),
    ("father",   "' aw wa:"),
    ("mother",   "' im ma:"),
    ("house",    "' bé ta:"),
    ("abandon",  "' maš lim"),
    ("king",     "' ma: lka:"),
    ("water",    "' ma: ia:"),
    ("go",       "' a: zil"),
]

VOICES = ["onyx", "echo", "nova"]

out_dir = Path("data/tts_test")
out_dir.mkdir(parents=True, exist_ok=True)

for word, phonetic in SAMPLES:
    for voice in VOICES:
        out_file = out_dir / f"{word}_{voice}.mp3"
        if out_file.exists():
            print(f"  skip (exists): {out_file.name}")
            continue

        print(f"Generating: {word} [{phonetic}] voice={voice} ...", end=" ")
        response = client.audio.speech.create(
            model="tts-1-hd",
            voice=voice,
            input=phonetic,
            response_format="mp3",
        )
        response.stream_to_file(str(out_file))
        print("done")

print(f"\n✓ Files written to: {out_dir.resolve()}")
print("Open the folder and listen — compare voices and pick the best one.")
