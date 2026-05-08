"""
Match scraped Assyrian pronunciation/audio data into syriac_words.

Source: offline-dic/data/scraped-assyrian.json
  - eastern_syriac: Syriac word (Eastern script)
  - phonetic:       text pronunciation
  - audio_url:      https://assyrianlanguages.org/sureth/audio/entryN.mp3

Target: syriac_words table
  - pronunciation:  populated from phonetic
  - audio_url:      populated from audio_url

Matching strategy (in order of priority):
  1. Exact: normalize(eastern_syriac) == word_normalized
  2. First-token: normalize(eastern_syriac) == normalize(word split on ، or ()

Only updates rows where pronunciation IS NULL (won't overwrite manual edits).

Usage:
    python scripts/v2_import_pronunciation.py --dry-run
    python scripts/v2_import_pronunciation.py
"""

import json, os, re, sys
sys.stdout.reconfigure(encoding='utf-8')

from supabase import create_client

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ['SUPABASE_KEY']
DRY_RUN = '--dry-run' in sys.argv

SOURCE = r'C:\Users\rober\OneDrive\Documents\GitHub\offline-dic\data\scraped-assyrian.json'

DIACRITICS_RE = re.compile(r'[ܰ-݊̈]')

def normalize(text: str) -> str:
    return DIACRITICS_RE.sub('', text).strip()

def first_token(word: str) -> str:
    """Extract the first Syriac word before ، or ( from a compound token."""
    return normalize(re.split(r'[،(]', word)[0].strip())


def fetch_all(client, table, columns):
    rows, page, size = [], 0, 1000
    while True:
        batch = (
            client.table(table).select(columns)
            .range(page * size, (page + 1) * size - 1)
            .execute().data
        )
        rows.extend(batch)
        if len(batch) < size:
            break
        page += 1
    return rows


def main():
    print('Loading source JSON...')
    with open(SOURCE, encoding='utf-8') as f:
        source = json.load(f)
    print(f'  {len(source)} source entries.')

    # Build lookup: normalized eastern_syriac → source entry
    # Keep the one with phonetic if duplicates exist
    source_map: dict[str, dict] = {}
    for entry in source:
        if not entry.get('eastern_syriac'):
            continue
        key = normalize(entry['eastern_syriac'])
        if not key:
            continue
        if key not in source_map or entry.get('phonetic'):
            source_map[key] = entry
    print(f'  {len(source_map)} unique normalized keys.')

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    print('\nFetching syriac_words...')
    db_words = fetch_all(client, 'syriac_words', 'id, word, word_normalized, pronunciation, audio_url')
    print(f'  {len(db_words)} rows loaded.')

    exact_matches    = []
    token_matches    = []
    no_match         = 0
    already_has_data = 0

    for w in db_words:
        if w.get('pronunciation') or w.get('audio_url'):
            already_has_data += 1
            continue

        norm = w['word_normalized']
        tok  = first_token(w['word'])

        source_entry = source_map.get(norm) or source_map.get(tok)
        if not source_entry:
            no_match += 1
            continue

        phonetic  = (source_entry.get('phonetic') or '').strip() or None
        audio_url = (source_entry.get('audio_url') or '').strip() or None

        if not phonetic and not audio_url:
            no_match += 1
            continue

        record = {
            'id':           w['id'],
            'pronunciation': phonetic,
            'audio_url':    audio_url,
            'match_type':   'exact' if source_map.get(norm) else 'token',
        }

        if source_map.get(norm):
            exact_matches.append(record)
        else:
            token_matches.append(record)

    total_matches = len(exact_matches) + len(token_matches)
    total_db      = len(db_words)

    print(f'\nMatch results:')
    print(f'  Exact matches:       {len(exact_matches):>6}')
    print(f'  First-token matches: {len(token_matches):>6}')
    print(f'  Total matches:       {total_matches:>6} / {total_db - already_has_data} eligible')
    print(f'  Already have data:   {already_has_data:>6} (skipped)')
    print(f'  No match:            {no_match:>6}')

    if DRY_RUN:
        # Show a few samples
        print('\nSample exact matches:')
        for r in exact_matches[:5]:
            w = next(x for x in db_words if x['id'] == r['id'])
            print(f"  {w['word'][:40]:<40} → {r['pronunciation']}")
        print('\nSample token matches:')
        for r in token_matches[:5]:
            w = next(x for x in db_words if x['id'] == r['id'])
            print(f"  {w['word'][:40]:<40} → {r['pronunciation']}")
        print('\nDry run — no writes.')
        return

    # Write in batches using upsert (only touches pronunciation + audio_url)
    all_matches = exact_matches + token_matches
    batch_size  = 500
    written     = 0

    word_lookup = {w['id']: w for w in db_words}

    upsert_rows = [
        {
            'id':              r['id'],
            'word':            word_lookup[r['id']]['word'],
            'word_normalized': word_lookup[r['id']]['word_normalized'],
            'pronunciation':   r['pronunciation'],
            'audio_url':       r['audio_url'],
        }
        for r in all_matches
    ]

    print(f'\nWriting {len(upsert_rows)} updates...')
    for i in range(0, len(upsert_rows), batch_size):
        batch = upsert_rows[i:i + batch_size]
        client.table('syriac_words').upsert(batch, on_conflict='id').execute()
        written += len(batch)
        print(f'  {written}/{len(upsert_rows)}...')

    print(f'\n✓ Done. {len(all_matches)} syriac_words updated with pronunciation/audio.')


if __name__ == '__main__':
    main()
