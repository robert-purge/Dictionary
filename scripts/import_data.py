"""
Import data/dictionary.json into Supabase.
Clears existing data first — safe to re-run.
"""
import json, os, sys
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
BATCH_SIZE = 100

def import_data(json_path: str):
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    with open(json_path, encoding='utf-8') as f:
        entries = json.load(f)

    print(f'Importing {len(entries)} entries...')

    # Clear existing rows (re-runnable)
    client.table('variants').delete().neq('id', 0).execute()
    client.table('entries').delete().neq('id', 0).execute()
    print('Cleared existing data.')

    inserted = 0
    for i in range(0, len(entries), BATCH_SIZE):
        batch = entries[i:i + BATCH_SIZE]

        entry_rows = [
            {'english': e['english'], 'part_of_speech': e.get('part_of_speech', '')}
            for e in batch
        ]
        result = client.table('entries').insert(entry_rows).execute()
        entry_ids = [row['id'] for row in result.data]
        assert len(entry_ids) == len(batch), f"Expected {len(batch)} IDs, got {len(entry_ids)}"

        variant_rows = []
        for entry_id, entry in zip(entry_ids, batch):
            for v in entry.get('variants', []):
                variant_rows.append({
                    'entry_id': entry_id,
                    'number': v.get('number', 1),
                    'assyrian': v.get('assyrian', ''),
                    'assyrian_normalized': v.get('assyrian_normalized', ''),
                    'arabic': v.get('arabic', ''),
                    'farsi': v.get('farsi'),
                    'example_assyrian': v.get('example_assyrian'),
                    'example_arabic': v.get('example_arabic'),
                })
        if variant_rows:
            client.table('variants').insert(variant_rows).execute()

        inserted += len(batch)
        print(f'  {inserted}/{len(entries)} entries imported...')

    print(f'Done. {len(entries)} entries imported.')

if __name__ == '__main__':
    import_data(sys.argv[1] if len(sys.argv) > 1 else 'data/dictionary.json')
