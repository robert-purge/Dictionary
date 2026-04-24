"""
Parse the Assyrian dictionary Word document into data/dictionary.json.

Each paragraph is ONE complete entry or variant on a single line:
  english[num] [•] pos. Syriac_text Arabic_text

Continuation variants start with a digit:
  2 • pos. Syriac_text Arabic_text

Run: python scripts/parse_word.py data/dictionary.docx data/dictionary.json
"""
import re, json, sys
from docx import Document

SYRIAC_VOWELS_RE = re.compile(r'[\u0730-\u074A]')
SECTION_HEADER_RE = re.compile(r'^-[A-Z]+-$')
ARABIC_LETTER_RE = re.compile(r'[\u0621-\u064A\u0660-\u06D6]')

POS_ABBRS = {
    'n', 'vt', 'vi', 'adv', 'adj', 'prep', 'conj', 'interj', 'pron',
    'art', 'num', 'abbr', 'v', 'see', 'cf', 'pl', 'sing', 'arch',
    'pref', 'suf', 'aux', 'det',
}

def normalize_syriac(text: str) -> str:
    return SYRIAC_VOWELS_RE.sub('', text)

def get_para_text(para) -> str:
    return ''.join(run.text for run in para.runs).strip()

def split_syriac_arabic(body: str) -> tuple[str, str]:
    """
    Given the body text (Syriac + Arabic mixed), split into separate strings.
    Strategy: find the last Syriac character; everything after it (skipping
    to the first Arabic letter) is the Arabic translation.
    """
    if not body:
        return '', ''

    last_syriac = -1
    for i, c in enumerate(body):
        if '\u0700' <= c <= '\u074F':
            last_syriac = i

    if last_syriac == -1:
        return '', body.strip()

    syriac = body[:last_syriac + 1].strip()
    after = body[last_syriac + 1:]

    m = ARABIC_LETTER_RE.search(after)
    arabic = after[m.start():].strip() if m else ''

    return syriac, arabic

def parse_header(raw: str) -> dict:
    """
    Parse the text before the first Syriac character.
    Returns dict with: english, pos, variant_num, is_continuation
    """
    text = re.sub(r'[\xa0\t]+', ' ', raw).strip()

    # Continuation variant: starts with a digit followed by • or .
    # Check BEFORE stripping trailing bullet
    if re.match(r'^\d+\s*[•\.]', text):
        m = re.match(r'^(\d+)\s*[•\.]\s*(.*)', text)
        num = int(m.group(1))
        rest = m.group(2).strip().rstrip('•').strip()
        pos = rest.split()[0] if rest else None
        return {'english': None, 'pos': pos, 'variant_num': num, 'is_continuation': True}

    if not re.match(r'^[a-zA-Z]', text):
        return {'english': None, 'pos': None, 'variant_num': None, 'is_continuation': False}

    # Pattern 1: inline variant — "abandon1 • vt." or "abandon1 vt."
    m1 = re.match(r'^([a-zA-Z][a-zA-Z\s\-\']*?)(\d+)\s*[•]?\s*(.*)', text)
    if m1:
        english = m1.group(1).strip().lower()
        variant = int(m1.group(2))
        pos_raw = m1.group(3).strip().rstrip('•').strip()
        pos = pos_raw.split()[0] if pos_raw else None
        return {'english': english, 'pos': pos, 'variant_num': variant, 'is_continuation': False}

    # Pattern 2: post-POS variant — "abase vt. 1 •" or "abbreviation n. 1 •"
    m2 = re.match(r'^([a-zA-Z][a-zA-Z\s\-\']*?)\s+([\w\.]+)\s+(\d+)\s*[•]', text)
    if m2:
        english = m2.group(1).strip().lower()
        pos = m2.group(2).strip()
        variant = int(m2.group(3))
        return {'english': english, 'pos': pos, 'variant_num': variant, 'is_continuation': False}

    # Pattern 3: simple entry — "aardvark n.zoo", "abbacy n.", "taken aback"
    tokens = text.split()
    english_tokens, pos_tokens, found_pos = [], [], False
    for tok in tokens:
        base = tok.rstrip('.')
        if not found_pos and (base.lower() in POS_ABBRS or re.match(r'^[a-z]+\.[a-z]*$', tok.lower())):
            found_pos = True
        (pos_tokens if found_pos else english_tokens).append(tok)

    english = ' '.join(english_tokens).lower() or text.lower()
    pos = ' '.join(pos_tokens) if pos_tokens else None
    return {'english': english, 'pos': pos, 'variant_num': None, 'is_continuation': False}

def new_variant(num: int) -> dict:
    return {
        'number': num,
        'assyrian': '',
        'assyrian_normalized': '',
        'arabic': '',
        'farsi': None,
        'example_assyrian': None,
        'example_arabic': None,
    }

def parse(docx_path: str) -> list[dict]:
    doc = Document(docx_path)
    entries: list[dict] = []
    current_entry: dict | None = None

    for para in doc.paragraphs:
        raw = get_para_text(para)
        if not raw:
            continue

        normalized = re.sub(r'[\xa0\t]+', ' ', raw).strip()
        if SECTION_HEADER_RE.match(normalized):
            continue

        syriac_start = next((i for i, c in enumerate(raw) if '\u0700' <= c <= '\u074F'), None)
        raw_header = raw[:syriac_start] if syriac_start is not None else raw
        body = raw[syriac_start:] if syriac_start is not None else ''

        assyrian, arabic = split_syriac_arabic(body)
        parsed = parse_header(raw_header)

        # Body-only paragraph (starts with Syriac, no English header):
        # fill in the last variant of the current entry
        if syriac_start == 0 and not parsed['english'] and not parsed['is_continuation']:
            if current_entry and current_entry['variants']:
                v = current_entry['variants'][-1]
                if not v['assyrian']:
                    v['assyrian'] = assyrian
                    v['arabic'] = arabic
                    v['assyrian_normalized'] = normalize_syriac(assyrian)
            continue

        if parsed['is_continuation']:
            if current_entry is not None:
                v = new_variant(parsed['variant_num'])
                v['assyrian'] = assyrian
                v['arabic'] = arabic
                v['assyrian_normalized'] = normalize_syriac(assyrian)
                # Replace existing empty variant with same number, otherwise append
                existing = next((i for i, ev in enumerate(current_entry['variants'])
                                 if ev['number'] == parsed['variant_num'] and not ev['assyrian']), None)
                if existing is not None:
                    current_entry['variants'][existing] = v
                else:
                    current_entry['variants'].append(v)

        elif parsed['english']:
            if current_entry:
                entries.append(current_entry)

            variant_num = parsed['variant_num'] or 1
            v = new_variant(variant_num)
            v['assyrian'] = assyrian
            v['arabic'] = arabic
            v['assyrian_normalized'] = normalize_syriac(assyrian)

            current_entry = {
                'english': parsed['english'],
                'part_of_speech': parsed['pos'],
                'variants': [v],
            }

    if current_entry:
        entries.append(current_entry)

    return entries

if __name__ == '__main__':
    docx_path = sys.argv[1] if len(sys.argv) > 1 else 'data/dictionary.docx'
    out_path = sys.argv[2] if len(sys.argv) > 2 else 'data/dictionary.json'
    entries = parse(docx_path)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
    print(f'Parsed {len(entries)} entries → {out_path}')
