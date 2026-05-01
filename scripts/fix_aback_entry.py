"""
Fix the contaminated "aback" variant and create a new "taken aback" entry.

Current state (variant_id=4, entry_id=4):
  - assyrian field has Arabic text + "taken aback" + its Syriac mixed in
  - arabic field has the Arabic for "taken aback" (wrong variant)

After fix:
  "aback" variant:
    assyrian = ܒܸܣܬܪܵܐܝܼܬ(ܒܣܬܪ)؛ ܒܲܬܪܵܐܝܼܬ، ܠܵܒܵܬ݇ܪܵܐ (ܒܬܪ)
    arabic   = إلى الوراء . إلى الخلف

  New entry "taken aback" (adv):
    assyrian = ܡܬܲܡܗܵܐ(ܕ.)، ܡܬܲܡܲܗܬܵܐ(ܢ.)؛ ܡܕܲܡܪܵܐ(ܕ.ܕܡܪ)؛ ܦܵܐܹܫ ܡܘܼܚܓ̰ܸܠܵܐ ܒܦܘܼܢܵܝܵܐ ܝܲܢ ܥܒ݂ܵܕܵܐ ܠܵܐ ܣܒܝܼܪܵܐ
    arabic   = يُفاجأ. يُؤخَذ على حين غِرّة

Usage:
    python scripts/fix_aback_entry.py           # live run
    python scripts/fix_aback_entry.py --dry-run # preview only
"""
import os, re, sys
sys.stdout.reconfigure(encoding='utf-8')
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
DRY_RUN = '--dry-run' in sys.argv

SYRIAC_DIACRITICS = re.compile(r'[ܰ-݊̈]')

def normalize(text: str) -> str:
    return SYRIAC_DIACRITICS.sub('', text).strip()

ABACK_VARIANT_ID = 4
ABACK_ENTRY_ID   = 4

ABACK_ASSYRIAN = 'ܒܸܣܬܪܵܐܝܼܬ(ܒܣܬܪ)؛ ܒܲܬܪܵܐܝܼܬ، ܠܵܒܵܬ݇ܪܵܐ (ܒܬܪ)'
ABACK_ARABIC   = 'إلى الوراء . إلى الخلف'

TAKEN_ABACK_ASSYRIAN = (
    'ܡܬܲܡܗܵܐ(ܕ.)، ܡܬܲܡܲܗܬܵܐ(ܢ.)؛ ܡܕܲܡܪܵܐ(ܕ.ܕܡܪ)؛ '
    'ܦܵܐܹܫ ܡܘܼܚܓ̰ܸܠܵܐ ܒܦܘܼܢܵܝܵܐ ܝܲܢ ܥܒ݂ܵܕܵܐ ܠܵܐ ܣܒܝܼܪܵܐ'
)
TAKEN_ABACK_ARABIC   = 'يُفاجأ. يُؤخَذ على حين غِرّة'


def main():
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # ── 1. Show current state ─────────────────────────────────────────────────
    current = (
        client.table('variants')
        .select('id, entry_id, assyrian, arabic')
        .eq('id', ABACK_VARIANT_ID)
        .single()
        .execute()
        .data
    )
    print("Current aback variant:")
    print(f"  assyrian : {current['assyrian']}")
    print(f"  arabic   : {current['arabic']}")
    print()

    # ── 2. Update aback variant ───────────────────────────────────────────────
    print(f"{'[DRY RUN] ' if DRY_RUN else ''}Updating aback variant (id={ABACK_VARIANT_ID}):")
    print(f"  assyrian → {ABACK_ASSYRIAN}")
    print(f"  arabic   → {ABACK_ARABIC}")

    if not DRY_RUN:
        client.table('variants').update({
            'assyrian':            ABACK_ASSYRIAN,
            'arabic':              ABACK_ARABIC,
            'assyrian_normalized': normalize(ABACK_ASSYRIAN),
        }).eq('id', ABACK_VARIANT_ID).execute()
        print("  ✓ Updated.")
    print()

    # ── 3. Create new "taken aback" entry ────────────────────────────────────
    print(f"{'[DRY RUN] ' if DRY_RUN else ''}Creating new entry 'taken aback' (adv):")
    print(f"  assyrian : {TAKEN_ABACK_ASSYRIAN}")
    print(f"  arabic   : {TAKEN_ABACK_ARABIC}")

    if not DRY_RUN:
        new_entry = (
            client.table('entries')
            .insert({'english': 'taken aback', 'part_of_speech': 'adv'})
            .execute()
            .data[0]
        )
        new_entry_id = new_entry['id']
        print(f"  ✓ Entry created (id={new_entry_id}).")

        client.table('variants').insert({
            'entry_id':            new_entry_id,
            'number':              1,
            'assyrian':            TAKEN_ABACK_ASSYRIAN,
            'arabic':              TAKEN_ABACK_ARABIC,
            'assyrian_normalized': normalize(TAKEN_ABACK_ASSYRIAN),
        }).execute()
        print(f"  ✓ Variant created.")
    print()
    print("Done.")


if __name__ == '__main__':
    main()
