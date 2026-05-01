"""
Parse the current variants.assyrian column into atomic syriac_words rows
and link them to entries via the entry_words junction table.

Splitting rules:
  - Split on ؛ (Arabic semicolon U+061B) and ; (ASCII semicolon)
  - Each resulting token is one atomic Syriac word (may include ، variants)
  - Tokens are deduplicated across the whole dictionary by word_normalized
  - First token from each variant inherits the Arabic/Farsi; the rest start null

Requires SUPABASE_SERVICE_KEY (service role key) — the anon key cannot insert
into new tables. Get it from Supabase dashboard → Settings → API → service_role.

Usage:
    python scripts/v2_migrate.py --dry-run   # stats only, no writes
    python scripts/v2_migrate.py             # live run
"""
import os, re, sys
sys.stdout.reconfigure(encoding='utf-8')
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
# Prefer service key (bypasses RLS); fall back to anon key for dry-run stats
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_KEY"]
DRY_RUN = '--dry-run' in sys.argv

# Split on Arabic semicolon or ASCII semicolon
SPLIT_RE = re.compile(r'[؛;]')

# Syriac diacritics U+0730–U+074A
DIACRITICS_RE = re.compile(r'[ܰ-݊̈]')

def normalize(text: str) -> str:
    return DIACRITICS_RE.sub('', text).strip()

def split_assyrian(field: str) -> list[str]:
    """Split an assyrian field into atomic word tokens."""
    tokens = []
    for tok in SPLIT_RE.split(field):
        tok = tok.strip()
        if tok:
            tokens.append(tok)
    return tokens


def fetch_all_variants(client) -> list[dict]:
    all_rows, page, page_size = [], 0, 1000
    while True:
        rows = (
            client.table('variants')
            .select('id, entry_id, assyrian, arabic, farsi')
            .range(page * page_size, (page + 1) * page_size - 1)
            .execute()
            .data
        )
        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        page += 1
    return all_rows


def main():
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("Fetching variants...")
    variants = fetch_all_variants(client)
    print(f"  Loaded {len(variants)} variants.")

    # ── Parse all tokens ──────────────────────────────────────────────────────
    # word_normalized → { word, arabic, farsi }  (first-occurrence wins)
    words_seen: dict[str, dict] = {}
    # List of (entry_id, variant_id, word_normalized, sort_order)
    links: list[tuple] = []

    total_tokens = 0
    empty_assyrian = 0

    for v in variants:
        assyrian = (v.get('assyrian') or '').strip()
        if not assyrian:
            empty_assyrian += 1
            continue

        tokens = split_assyrian(assyrian)
        arabic_ref = (v.get('arabic') or '').strip() or None
        farsi_ref  = (v.get('farsi')  or '').strip() or None

        for i, tok in enumerate(tokens):
            norm = normalize(tok)
            if not norm:
                continue

            total_tokens += 1

            if norm not in words_seen:
                words_seen[norm] = {
                    'word':             tok,
                    'word_normalized':  norm,
                    # First token from this variant gets Arabic/Farsi as reference
                    'arabic':           arabic_ref if i == 0 else None,
                    'farsi':            farsi_ref  if i == 0 else None,
                }

            links.append((v['entry_id'], v['id'], norm, i))

    print(f"\nParsed {total_tokens} tokens → {len(words_seen)} unique Syriac words")
    print(f"  {len(links)} entry_words links to create")
    print(f"  {empty_assyrian} variants had empty assyrian (skipped)")

    # Word count distribution
    counts = {}
    for v in variants:
        assyrian = (v.get('assyrian') or '').strip()
        if assyrian:
            n = len(split_assyrian(assyrian))
            counts[n] = counts.get(n, 0) + 1
    print("\nWords per variant distribution:")
    for n in sorted(counts):
        print(f"  {n:3d} words: {counts[n]} variants")

    if DRY_RUN:
        print("\nDry run — no changes written.")
        return

    # ── Insert syriac_words ───────────────────────────────────────────────────
    print("\nInserting syriac_words...")
    word_rows = list(words_seen.values())
    batch_size = 500
    inserted_words = 0

    for i in range(0, len(word_rows), batch_size):
        batch = word_rows[i:i + batch_size]
        client.table('syriac_words').upsert(
            batch,
            on_conflict='word_normalized',
            ignore_duplicates=True,
        ).execute()
        inserted_words += len(batch)
        print(f"  {inserted_words}/{len(word_rows)} words...")

    print(f"  ✓ {len(word_rows)} syriac_words rows upserted.")

    # ── Fetch word id map ─────────────────────────────────────────────────────
    print("Fetching syriac_word ids...")
    id_map: dict[str, int] = {}
    page = 0
    while True:
        rows = (
            client.table('syriac_words')
            .select('id, word_normalized')
            .range(page * 1000, (page + 1) * 1000 - 1)
            .execute()
            .data
        )
        for r in rows:
            id_map[r['word_normalized']] = r['id']
        if len(rows) < 1000:
            break
        page += 1
    print(f"  Loaded {len(id_map)} word ids.")

    # ── Insert entry_words ────────────────────────────────────────────────────
    print("Inserting entry_words...")
    link_rows = []
    for entry_id, variant_id, norm, sort_order in links:
        word_id = id_map.get(norm)
        if word_id is None:
            continue
        link_rows.append({
            'entry_id':          entry_id,
            'syriac_word_id':    word_id,
            'source_variant_id': variant_id,
            'sort_order':        sort_order,
        })

    inserted_links = 0
    for i in range(0, len(link_rows), batch_size):
        batch = link_rows[i:i + batch_size]
        client.table('entry_words').insert(batch).execute()
        inserted_links += len(batch)
        print(f"  {inserted_links}/{len(link_rows)} links...")

    print(f"  ✓ {len(link_rows)} entry_words rows inserted.")
    print("\nMigration complete.")


if __name__ == '__main__':
    main()
