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

    # Fetch variants with null farsi, join to get the English headword
    result = client.table('variants').select(
        'id, entry_id, entries(english)'
    ).is_('farsi', 'null').execute()

    rows = result.data
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
            time.sleep(0.1)  # Avoid rate limiting
        except Exception as e:
            print(f'  Warning: skipped "{english}": {e}')

    print(f'Done. {updated} Farsi translations added.')

if __name__ == '__main__':
    enrich_farsi()
