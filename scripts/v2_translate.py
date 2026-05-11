"""
Translate null Arabic fields in syriac_words using Claude Haiku.
Words are sent in batches of 10 with their English context for accuracy.

Cost estimate: ~36,000 words ÷ 10 per batch = 3,600 API calls
               using claude-haiku-4-5 ≈ $2–4 total

Usage:
    python scripts/v2_translate.py --sample   # translate 30 words, show results, no writes
    python scripts/v2_translate.py            # full run, writes to database
"""
import json, os, re, sys, time
sys.stdout.reconfigure(encoding='utf-8')

from supabase import create_client
import anthropic

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
ANTHROPIC_KEY = os.environ["ANTHROPIC_API_KEY"]

SAMPLE_MODE = '--sample' in sys.argv
SAMPLE_SIZE = 30
BATCH_SIZE  = 10  # words per Claude call

ROOT_ANNOTATION_RE = re.compile(r'\([^)]{1,30}\)')


def clean_word(word: str) -> str:
    cleaned = ROOT_ANNOTATION_RE.sub('', word)
    return cleaned.strip(' ،؛;')


def fetch_null_words(client, limit=None) -> list[dict]:
    all_rows, page, page_size = [], 0, 1000
    while True:
        rows = (
            client.table('syriac_words')
            .select('id, word')
            .is_('arabic', 'null')
            .range(page * page_size, (page + 1) * page_size - 1)
            .execute()
            .data
        )
        all_rows.extend(rows)
        if limit and len(all_rows) >= limit:
            return all_rows[:limit]
        if len(rows) < page_size:
            break
        page += 1
    return all_rows


def fetch_english_context(client, word_ids: list[int]) -> dict[int, str]:
    context = {}
    for i in range(0, len(word_ids), 500):
        batch = word_ids[i:i + 500]
        rows = (
            client.table('entry_words')
            .select('syriac_word_id, entries(english)')
            .in_('syriac_word_id', batch)
            .execute()
            .data
        )
        for r in rows:
            wid = r['syriac_word_id']
            if wid not in context and r.get('entries'):
                context[wid] = r['entries']['english']
    return context


def translate_batch(batch: list[dict], claude_client) -> dict[int, str]:
    """
    Send up to BATCH_SIZE words to Claude in one call.
    Returns {word_id: arabic_translation}.
    """
    lines = []
    for item in batch:
        cleaned = clean_word(item['word'])
        english = item.get('english', '')
        lines.append(f'{item["id"]}|{cleaned}|{english}')

    prompt = (
        'You are translating Assyrian/Syriac dictionary words to Arabic.\n'
        'Each line has format: ID|SyriacWord|EnglishMeaning\n'
        'Reply with ONLY a JSON object mapping each ID to its Arabic translation.\n'
        'If you cannot translate a word, use null for that ID.\n'
        'Example reply: {"123": "يترك", "124": "يُسلِم", "125": null}\n\n'
        + '\n'.join(lines)
    )

    for attempt in range(4):
        try:
            msg = claude_client.messages.create(
                model='claude-haiku-4-5-20251001',
                max_tokens=300,
                messages=[{'role': 'user', 'content': prompt}]
            )
            raw = msg.content[0].text.strip()
            match = re.search(r'\{[^{}]+\}', raw, re.DOTALL)
            if not match:
                return {}
            data = json.loads(match.group())
            return {int(k): v for k, v in data.items() if v}
        except anthropic.RateLimitError:
            wait = 15 * (attempt + 1)
            print(f'  Rate limit hit, waiting {wait}s...')
            time.sleep(wait)
        except Exception as e:
            print(f'  Batch error: {e}')
            return {}
    return {}


def main():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    claude   = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

    print(f"Fetching null-Arabic syriac_words{' (sample)' if SAMPLE_MODE else ''}...")
    words = fetch_null_words(supabase, limit=SAMPLE_SIZE if SAMPLE_MODE else None)
    print(f"  {len(words)} words to translate.")

    print("Fetching English context...")
    word_ids = [w['id'] for w in words]
    english_map = fetch_english_context(supabase, word_ids)
    for w in words:
        w['english'] = english_map.get(w['id'], '')

    # ── Translate in batches ──────────────────────────────────────────────────
    total_batches = (len(words) + BATCH_SIZE - 1) // BATCH_SIZE

    print(f"Translating in {total_batches} batches of {BATCH_SIZE}...")
    translated = failed = 0

    for i in range(0, len(words), BATCH_SIZE):
        batch = words[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        translations = translate_batch(batch, claude)

        if SAMPLE_MODE:
            for w in batch:
                t = translations.get(w['id'], 'FAILED')
                print(f"  '{w['word'][:35]}' [{w['english']}] → {t}")
        else:
            # Write this batch immediately — enables resume on crash
            for word_id, arabic in translations.items():
                for attempt in range(3):
                    try:
                        supabase.table('syriac_words').update(
                            {'arabic': arabic}
                        ).eq('id', word_id).execute()
                        break
                    except Exception:
                        if attempt == 2:
                            print(f"  Warning: failed to write word {word_id}, skipping")
                        else:
                            time.sleep(2 ** attempt)
                            supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

            translated += len(translations)
            failed     += len(batch) - len(translations)

            if batch_num % 10 == 0:
                print(f"  Batch {batch_num}/{total_batches} — {translated} written, {failed} failed")

        time.sleep(1.5)

    if SAMPLE_MODE:
        print("\nSample run complete — no changes written.")
    else:
        print(f"\nDone. {translated} translations written, {failed} still need manual review.")
        print("Re-run the script to retry any remaining null words.")


if __name__ == '__main__':
    main()
