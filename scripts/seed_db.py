import json, os, re, sys
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
SYRIAC_VOWELS = re.compile(r'[\u0730-\u074A]')

def normalize_syriac(text: str) -> str:
    return SYRIAC_VOWELS.sub('', text) if text else ''

def seed(path: str):
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    with open(path, encoding='utf-8') as f:
        entries = json.load(f)
    for entry in entries:
        result = client.table('entries').insert({
            'english': entry['english'],
            'part_of_speech': entry.get('part_of_speech', ''),
        }).execute()
        entry_id = result.data[0]['id']
        for v in entry.get('variants', []):
            assyrian = v.get('assyrian', '')
            client.table('variants').insert({
                'entry_id': entry_id,
                'number': v.get('number', 1),
                'assyrian': assyrian,
                'assyrian_normalized': normalize_syriac(assyrian),
                'arabic': v.get('arabic', ''),
                'farsi': v.get('farsi'),
                'example_assyrian': v.get('example_assyrian'),
                'example_arabic': v.get('example_arabic'),
            }).execute()
    print(f"Seeded {len(entries)} entries.")

if __name__ == '__main__':
    seed(sys.argv[1] if len(sys.argv) > 1 else 'data/seed.json')
