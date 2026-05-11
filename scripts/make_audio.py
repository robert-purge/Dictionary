import json
import asyncio
import edge_tts
from pathlib import Path

INPUT_JSON = "data/phonetics.json"
OUT_DIR = Path("data/generated_audio")
VOICE = "en-US-AriaNeural"   # test voice

OUT_DIR.mkdir(exist_ok=True)

def clean_phonetic(text: str) -> str:
    # Make phonetic text easier for TTS to read
    text = text.replace("'", "")
    text = text.replace(":", "ː")   # long vowel marker
    text = text.replace("/", " or ")
    return text.strip()

async def main():
    with open(INPUT_JSON, "r", encoding="utf-8") as f:
        words = json.load(f)

    for item in words:
        word_id = item["id"]
        phonetic = clean_phonetic(item["phonetic"])

        output_file = OUT_DIR / f"entry{word_id}.mp3"

        communicate = edge_tts.Communicate(
            text=phonetic,
            voice=VOICE,
            rate="-15%"
        )

        await communicate.save(str(output_file))
        print(f"Created: entry{word_id}.mp3  {output_file.stat().st_size} bytes")

asyncio.run(main())