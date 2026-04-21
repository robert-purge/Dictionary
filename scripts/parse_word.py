"""
Parse the Assyrian dictionary Word document into data/dictionary.json.

Document structure (from screenshot analysis):
- Section headers: "-A-", "-B-" etc. — skip these
- English entry line: "word part_of_speech" in Latin script (e.g. "abase vt.")
- Assyrian translations: lines in Syriac Unicode (U+0700–U+074F)
- Arabic translations: lines in Arabic Unicode (U+0600–U+06FF)
- Numbered variants: lines starting with "1•", "2°", "3•" etc.

NOTE: Run on a small excerpt first and inspect output before processing the full document.
Adjust split_english_pos() if your doc uses different part-of-speech abbreviations.
"""
import re, json, sys
from docx import Document

SYRIAC_RE = re.compile(r'[\u0700-\u074F]')
ARABIC_RE = re.compile(r'[\u0600-\u06FF]')
LATIN_RE = re.compile(r'[a-zA-Z]')
SYRIAC_VOWELS_RE = re.compile(r'[\u0730-\u074A]')
SECTION_HEADER_RE = re.compile(r'^-[A-Z]+-$')
VARIANT_NUM_RE = re.compile(r'^(\d+)\s*[°•\.\s]')

POS_ABBRS = {'n', 'vt', 'vi', 'adv', 'adj', 'prep', 'conj', 'interj', 'pron', 'art', 'num', 'abbr', 'v'}

def detect_script(text: str) -> str:
    if SYRIAC_RE.search(text): return 'syriac'
    if ARABIC_RE.search(text): return 'arabic'
    if LATIN_RE.search(text): return 'latin'
    return 'unknown'

def normalize_syriac(text: str) -> str:
    return SYRIAC_VOWELS_RE.sub('', text)

def split_english_pos(text: str) -> tuple[str, str]:
    """Split 'abase vt.' or 'aardvark n.zoo' into ('abase', 'vt.') / ('aardvark', 'n.zoo')"""
    parts = text.strip().split()
    if len(parts) <= 1:
        return text.strip().lower(), ''
    word = parts[0].lower()
    # Remaining tokens after the headword are part of speech
    pos_parts = []
    for token in parts[1:]:
        base = token.rstrip('.').lower()
        if base in POS_ABBRS or token[0].islower():
            pos_parts.append(token)
    return word, ' '.join(pos_parts) if pos_parts else ' '.join(parts[1:])

def get_para_text(para) -> str:
    return ''.join(run.text for run in para.runs).strip()

def parse(docx_path: str) -> list[dict]:
    doc = Document(docx_path)
    entries: list[dict] = []
    current_entry: dict | None = None
    current_variant: dict | None = None

    def new_variant(num: int) -> dict:
        return {'number': num, 'assyrian': '', 'arabic': '', 'farsi': None,
                'example_assyrian': None, 'example_arabic': None}

    for para in doc.paragraphs:
        text = get_para_text(para)
        if not text or SECTION_HEADER_RE.match(text):
            continue

        script = detect_script(text)
        variant_match = VARIANT_NUM_RE.match(text)

        if script == 'latin' and not variant_match:
            # Save previous entry
            if current_entry:
                entries.append(current_entry)
            english, pos = split_english_pos(text)
            current_variant = new_variant(1)
            current_entry = {
                'english': english,
                'part_of_speech': pos,
                'variants': [current_variant],
            }

        elif variant_match and current_entry is not None:
            num = int(variant_match.group(1))
            current_variant = new_variant(num)
            current_entry['variants'].append(current_variant)

        elif script == 'syriac' and current_variant is not None:
            sep = '؛ ' if current_variant['assyrian'] else ''
            current_variant['assyrian'] += sep + text

        elif script == 'arabic' and current_variant is not None:
            sep = '؛ ' if current_variant['arabic'] else ''
            current_variant['arabic'] += sep + text

    if current_entry:
        entries.append(current_entry)

    # Compute normalized Assyrian for each variant
    for entry in entries:
        for v in entry['variants']:
            v['assyrian_normalized'] = normalize_syriac(v['assyrian'])

    return entries

if __name__ == '__main__':
    docx_path = sys.argv[1] if len(sys.argv) > 1 else 'data/dictionary.docx'
    out_path = sys.argv[2] if len(sys.argv) > 2 else 'data/dictionary.json'
    entries = parse(docx_path)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
    print(f'Parsed {len(entries)} entries → {out_path}')
