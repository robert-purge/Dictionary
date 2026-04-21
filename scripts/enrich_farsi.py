"""
One-time script: translate all NULL farsi values using Google Translate (EN → FA).
Uses deep-translator. Safe to re-run — only processes rows where farsi IS NULL.
"""
import os, time
from supabase import create_client
from deep_translator import GoogleTranslator

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

def enrich_farsi():
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    translator = GoogleTranslator(source='en', target='fa')

    # Fetch all variants with null farsi in pages (Supabase default limit is 1000)
    rows = []
    page_size = 1000
    offset = 0
    while True:
        result = client.table('variants').select(
            'id, entry_id, entries(english)'
        ).is_('farsi', 'null').range(offset, offset + page_size - 1).execute()
        rows.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size

    print(f'Found {len(rows)} variants needing Farsi translation.')

    updated = 0
    for row in rows:
        english = row['entries']['english']
        try:
            farsi = translator.translate(english)
            client.table('variants').update({'farsi': farsi}).eq('id', row['id']).execute()
            updated += 1
            if updated % 50 == 0:
                print(f'  {updated}/{len(rows)} translated...')
        except Exception as e:
            print(f'  Warning: skipped "{english}": {e}')
        time.sleep(0.1)  # Avoid rate limiting (runs on success and failure)

    print(f'Done. {updated} Farsi translations added.')

if __name__ == '__main__':
    enrich_farsi()
