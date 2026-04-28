"""
Parse the Assyrian dictionary Word document into data/dictionary.json.

Document structure (observed from raw paragraphs):
  -A-                          section header — skip
  word\xa0pos. Syriac Arabic   simple entry (non-breaking space separates headword from POS)
  word1\xa0•\xa0pos. Syriac    variant number attached to headword: "abandon1"
  word\xa0pos. 1\xa0•\xa0Syr   variant number after POS: "abase vt. 1 •"
  2\xa0•\xa0pos. Syriac Arabic  continuation variant on its own line
  Syriac Arabic                body-only line — fill last empty variant of current entry

The headword ends at the first \xa0 or tab character.
Trailing digit on the headword is the variant number (e.g. "abandon1" -> variant 1).
"""
import re, json, sys
from docx import Document

SYRIAC_VOWELS_RE = re.compile(r'[ܰ-݊]')
SECTION_HEADER_RE = re.compile(r'^-[A-Z]+-$')
ARABIC_LETTER_RE = re.compile(r'[ء-ي٠-ۖ]')


def normalize_syriac(text: str) -> str:
    return SYRIAC_VOWELS_RE.sub('', text)


def split_syriac_arabic(body: str) -> tuple:
    """Split body text (from first Syriac char onwards) into Syriac and Arabic."""
    if not body:
        return '', ''
    last_syriac = -1
    for i, c in enumerate(body):
        if '܀' <= c <= 'ݏ':
            last_syriac = i
    if last_syriac == -1:
        return '', body.strip()
    # Extend past the last Syriac character to include closing punctuation
    # that belongs to the Syriac text, e.g. the ")." in "(ܕ.ܢ.)"
    end = last_syriac + 1
    while end < len(body) and body[end] in ').,؛; \t':
        end += 1
    syriac = body[:end].strip()
    after = body[end:]
    m = ARABIC_LETTER_RE.search(after)
    arabic = after[m.start():].strip() if m else ''
    return syriac, arabic


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


def extract_headword(raw_before_sep: str) -> tuple:
    """
    Extract headword and optional inline variant number from the text
    before the first separator. e.g.:
      "abandon1" -> ("abandon", 1)
      "able2"    -> ("able", 2)
      "aback"    -> ("aback", None)
    """
    m = re.match(r'^([a-zA-Z][a-zA-Z\s\-\'\/]*)(\d+)?$', raw_before_sep.strip())
    if m:
        return m.group(1).strip().lower(), (int(m.group(2)) if m.group(2) else None)
    return raw_before_sep.strip().lower(), None


def extract_pos_and_variant(header_text: str) -> tuple:
    """
    Extract POS and optional variant number from the text between
    the headword separator and the first Syriac character.
    e.g. "• vt."        -> ("vt", None)
         "vt. 1 •"      -> ("vt", 1)
         "1 • vt."      -> ("vt", 1)   (digit-first format like "abate\xa01\xa0•\xa0vt.")
         "n.zoo"        -> ("n.zoo", None)
    """
    text = re.sub(r'[\xa0\t]+', ' ', header_text).strip().lstrip('•').strip()

    # Find "N •" pattern (variant number, either before or after POS)
    m = re.search(r'(\d+)\s*[•]', text)
    variant_num = int(m.group(1)) if m else None

    if m:
        before = text[:m.start()].strip()
        after  = text[m.end():].strip()
        # If digit was at the start, POS is after the bullet; otherwise POS is before
        pos_part = after if not before else before
    else:
        pos_part = text.strip()

    pos = re.sub(r'\s*[•]\s*', '', pos_part).strip().rstrip('.').strip() or None
    return pos, variant_num


def parse(docx_path: str) -> list:
    with open(docx_path, 'rb') as f:
        doc = Document(f)

    entries = []
    current_entry = None

    for para in doc.paragraphs:
        raw = ''.join(r.text for r in para.runs).strip()
        if not raw:
            continue

        norm = re.sub(r'[\xa0\t]+', ' ', raw).strip()

        # Skip section headers like -A-, -B-
        if SECTION_HEADER_RE.match(norm):
            continue

        # Find where Syriac starts
        syriac_start = next((i for i, c in enumerate(raw) if '܀' <= c <= 'ݏ'), None)
        body = raw[syriac_start:] if syriac_start is not None else ''
        assyrian, arabic = split_syriac_arabic(body)

        # ── Continuation variant: line starts with digit ──────────────────
        if re.match(r'^\d+[\xa0\t\s]*[•.]', raw):
            if current_entry is not None:
                num = int(re.match(r'^(\d+)', raw).group(1))
                v = new_variant(num)
                v['assyrian'] = assyrian
                v['assyrian_normalized'] = normalize_syriac(assyrian)
                v['arabic'] = arabic
                # Replace existing empty slot with same number, or append
                existing = next(
                    (i for i, ev in enumerate(current_entry['variants'])
                     if ev['number'] == num and not ev['assyrian']),
                    None
                )
                if existing is not None:
                    current_entry['variants'][existing] = v
                else:
                    current_entry['variants'].append(v)
            continue

        # ── Body-only line: starts with Syriac ───────────────────────────
        if syriac_start == 0:
            if current_entry:
                last_v = current_entry['variants'][-1]
                if not last_v['assyrian']:
                    last_v['assyrian'] = assyrian
                    last_v['assyrian_normalized'] = normalize_syriac(assyrian)
                    last_v['arabic'] = arabic
            continue

        # ── English-starting line: new entry ─────────────────────────────
        if re.match(r'^[a-zA-Z]', raw):
            if current_entry:
                entries.append(current_entry)

            # Headword ends at the first \xa0 or tab
            sep_pos = next((i for i, c in enumerate(raw) if c in ('\xa0', '\t')), None)

            if sep_pos is not None:
                raw_before_sep = raw[:sep_pos]
                raw_after_sep = raw[sep_pos + 1:syriac_start] if syriac_start is not None else raw[sep_pos + 1:]
            else:
                # No \xa0/tab separator — headword is the first word only;
                # everything else before Syriac is the POS/header area
                all_before = (raw[:syriac_start] if syriac_start is not None else raw).strip()
                first_space = all_before.find(' ')
                if first_space > 0:
                    raw_before_sep = all_before[:first_space]
                    raw_after_sep  = all_before[first_space + 1:]
                else:
                    raw_before_sep = all_before
                    raw_after_sep  = ''

            headword, variant_from_headword = extract_headword(raw_before_sep)
            pos, variant_from_header = extract_pos_and_variant(raw_after_sep)
            variant_num = variant_from_headword or variant_from_header or 1

            v = new_variant(variant_num)
            v['assyrian'] = assyrian
            v['assyrian_normalized'] = normalize_syriac(assyrian)
            v['arabic'] = arabic

            current_entry = {
                'english': headword,
                'part_of_speech': pos,
                'variants': [v],
            }
            continue

        # Everything else: skip

    if current_entry:
        entries.append(current_entry)

    return entries


if __name__ == '__main__':
    docx_path = sys.argv[1] if len(sys.argv) > 1 else 'data/Bailis Dictionary A-Z.docx'
    out_path = sys.argv[2] if len(sys.argv) > 2 else 'data/dictionary.json'
    entries = parse(docx_path)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
    print(f'Parsed {len(entries)} entries to {out_path}')
