"""
Remove embedded English fragments from 5 contaminated Assyrian variant fields.

Usage:
    python scripts/fix_contaminated_variants.py           # live run
    python scripts/fix_contaminated_variants.py --dry-run # preview only
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

# Each entry: (variant_id, description, cleaned_assyrian)
FIXES = [
    (
        601,
        'all right — remove (he is sick...) example',
        'ܕܠܵܐ ܟܒܲܪ(ܟܒܪ)؛ ܕܠܵܐ ܦܘܼܫܵܟ݂ܵܐ(ܦܫܟ)؛ ܣܲܬܝܼܬܵܐܝܼܬ(ܣܬܬ)؛ ܫܲܪܝܼܪܵܐܝܼܬ(ܫܪ)؛ ܕܠܵܐ ܫܸܟܘܼܬܵܐ؛ ܒܚܵܛܸܪܓ̰ܲܡܥܘܼܬܵܐ',
    ),
    (
        8943,
        'hiatus — remove "reenter" example word',
        'ܦܘܼܣܵܩ ܪܸܬܡܵܐ(ܕ.ܦܣܩ)؛ ܡܲܢܝܲܚܬܵܐ ܟܪܝܼܬܵܐ ܒܪܸܬܡܵܐ ܕܬܲܪܬܹܝ ܐܵܬܘܵܬܹܐ ܟܪܝܼܗܵܬܹܐ ܢܲܩܝܼܦܵܬܹܐ ܠܵܐ ܚܒ݂ܝܼܫܹܐ ܒܚܲܕ ܗܸܓܝܵܢܵܐ ܐܲܝܟ݂ ܕܐܵܬܘܵܬܹܐ e ܒܚܲܒܪܵܐ',
    ),
    (
        12398,
        'mis- — remove (mistrust) example',
        'ܕܲܠܩܘܼܒ݂ܠܵܝܘܼܬܵܐ(ܕܠܩܒ݂)؛ ܠܲܝܬܵܝܘܼܬܵܐ(ܐܝܼܬ)؛ ܒܵܨܘܿܪܘܼܬܵܐ (ܒܨܪ);',
    ),
    (
        16746,
        'protasis — remove )apodosis cross-reference label',
        'ܫܘܼܘܕܵܝܵܐ(ܕ.ܝܕܐ)؛ ܦܪܘܿܛܵܣܝܼܣ(ܢ.)؛ ܡܢܵܬܵܐ ܩܲܕܡܵܝܬܵܐ ܕܡܹܐܡܪܵܐ ܫܲܪܛܵܝܵܐ(ܢ.ܡܢܐ)(ܒܗܸܦܟܵܐ ܕܦܘܼܪܥܵܢܵܐ)؛ ܫܘܼܪܵܝܵܐ ܕܪܵܡܹܙ ܠܫܲܪܛܵܐ ܒܡܹܐܡܪܵܐ ܫܲܪܛܵܝܵܐ(ܕ.)',
    ),
    (
        19740,
        'semi- — remove stray Prefix. label',
        'ܚܫܲܚܬܵܐ ܡܫܲܪܝܵܢܝܼܬܵܐ ܒܐܲܢܹܐ ܣܘܼܟܵܠܹܐ 1\xa0•\xa0ܦܸܠܓܵܐ(ܕ.)، ܦܸܠܓܘܼܬܵܐ(ܢ.)، ܦܸܠܓܘܼ(ܢ.ܦܠܓ)',
    ),
]


def main():
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    for variant_id, description, cleaned in FIXES:
        current = (
            client.table('variants')
            .select('assyrian')
            .eq('id', variant_id)
            .single()
            .execute()
            .data
        )
        print(f"variant {variant_id} — {description}")
        print(f"  before: {current['assyrian']}")
        print(f"  after : {cleaned}")

        if not DRY_RUN:
            client.table('variants').update({
                'assyrian':            cleaned,
                'assyrian_normalized': normalize(cleaned),
            }).eq('id', variant_id).execute()
            print("  ✓ Updated.")
        print()

    print("Done." if not DRY_RUN else "Dry run complete — no changes made.")


if __name__ == '__main__':
    main()
