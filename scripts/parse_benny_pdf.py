"""
Parse Benny Dictionary PDF using Tesseract OCR (Syriac + English).

Entry structure:
  <Syriac headword>  [m./f.]  <English definition(s)>  [(pos.)]  [pl. <Syriac>]

Known OCR issues handled:
  - £ / £ misread as f. (feminine gender)
  - / misread as f. when used as gender marker
  - Reversed lines: OCR outputs English first, Syriac headword last
  - Garbled headword with no gender marker
  - Numbered items 1) 2) are definitions within the same entry

Column order: left first, right second (per page).
Output: data/benny_parsed.csv
"""

import sys
import csv
import re
import os
import fitz
import pytesseract
from PIL import Image
import io

sys.stdout.reconfigure(encoding='utf-8')

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
os.environ['TESSDATA_PREFIX'] = r'C:\Program Files\Tesseract-OCR\tessdata'

PDF_PATH = r'c:\Users\rober\OneDrive\Documents\GitHub\Dictionary\data\Benny Dictionary 1-9.pdf'
OUT_PATH = r'c:\Users\rober\OneDrive\Documents\GitHub\Dictionary\data\benny_parsed.csv'

TESS_CONFIG = '-l syr+eng --psm 4'
ZOOM = 2.5

SYRIAC_RE = re.compile(r'[܀-ݏ]+')

# Common English words that can appear at the start of a continuation line
CONTINUATION_STARTERS = {
    'plant', 'hermit', 'brother', 'another', 'specialist', 'professional',
    'unanimity', 'immediately', 'patriot', 'skill', 'hermits', 'ancestors',
    'clergymen', 'monks', 'parents', 'products', 'inanimity', 'and', 'or',
    'the', 'a', 'an', 'of', 'in', 'to', 'by', 'for', 'its', 'is', 'are',
    'see', 'also', 'from', '2)', '3)', '4)',
}


def render_page(page):
    mat = fitz.Matrix(ZOOM, ZOOM)
    pix = page.get_pixmap(matrix=mat)
    return Image.open(io.BytesIO(pix.tobytes('png')))


def ocr_columns(page):
    img = render_page(page)
    w, h = img.size
    mid = w // 2
    left  = pytesseract.image_to_string(img.crop((0,   0, mid, h)), config=TESS_CONFIG)
    right = pytesseract.image_to_string(img.crop((mid, 0, w,   h)), config=TESS_CONFIG)
    return [('L', left), ('R', right)]


def preprocess(line):
    """Fix systematic OCR substitutions before parsing."""
    line = line.replace('\u200F', '').replace('\u200E', '').replace('​', '').strip()
    # £ and standalone / are OCR misreads of f. (feminine marker)
    line = re.sub(r'\b£\s', 'f. ', line)
    line = re.sub(r'^f\s+(?=[A-Z])', 'f. ', line)   # "f Agreement" → "f. Agreement"
    # m.1) or f.1) with no space after period
    line = re.sub(r'\b([mf])\.([\d])', r'\1. \2', line)
    return line


def classify_line(line):
    """
    Returns one of:
      'syriac_start'   — line starts with Syriac (normal entry)
      'reversed'       — Syriac headword is at END of line (OCR reversed it)
      'gender_start'   — garbled headword + m./f. (entry with garbled Syriac)
      'garbled_only'   — garbled headword, no gender, but looks like an entry start
      'continuation'   — continuation of the previous entry
    """
    if not line:
        return 'continuation'

    first_word = line.split()[0] if line.split() else ''

    # 1. Starts with Syriac character
    if SYRIAC_RE.match(line):
        return 'syriac_start'

    # 2. Gender marker at start → reversed entry (headword comes at end)
    if re.match(r'^[mf]\.\s+\S', line):
        return 'reversed'

    # 3. English text with Syriac ONLY at the end → reversed entry
    # (but not if it has (n.) etc. mid-line which means it's a continuation)
    trailing = re.search(r'\s([܀-ݏ]\S*)$', line)
    if trailing and not SYRIAC_RE.match(line):
        # Is the Syriac token at the end likely a headword?
        before = line[:trailing.start()].strip()
        # It's reversed if the text before has no partial-word artifacts
        if not re.search(r'\(n\.\)|adj\.|adv\.', before):
            return 'reversed'

    # 4. Garbled headword with gender: <token> m./f. <english>
    if re.match(r'^\S+\s+[mf]\.\s+\S', line):
        return 'gender_start'

    # 5. Garbled headword without gender: short non-English token + text
    if (first_word and len(first_word) <= 8
            and first_word.lower().rstrip('.,;:)') not in CONTINUATION_STARTERS
            and not re.match(r'^\d+\)', first_word)          # not "2)"
            and re.search(r'[A-Za-z]{2,}', line[len(first_word):])):  # followed by English
        return 'garbled_only'

    return 'continuation'


def parse_entries(raw_text):
    entries = []
    lines = [preprocess(l) for l in raw_text.splitlines()]

    current_hw     = ''
    current_gender = ''
    current_rest   = ''

    def flush():
        nonlocal current_hw, current_gender, current_rest
        if current_hw and current_rest.strip():
            entries.append(make_entry(current_hw, current_gender, current_rest))
        current_hw     = ''
        current_gender = ''
        current_rest   = ''

    for line in lines:
        if not line:
            continue
        if re.fullmatch(r'[\d\s|*#¦\-]+', line):
            continue

        kind = classify_line(line)

        if kind == 'syriac_start':
            flush()
            m = re.match(r'^([܀-ݏ]\S*)\s*(.*)', line, re.DOTALL)
            hw   = m.group(1)
            rest = m.group(2).strip()
            gm   = re.match(r'^([mf])\.\s*(.*)', rest, re.DOTALL)
            if gm:
                current_hw, current_gender, current_rest = hw, gm.group(1), gm.group(2)
            else:
                current_hw, current_gender, current_rest = hw, '', rest

        elif kind == 'reversed':
            flush()
            # Gender may be at the start
            gm = re.match(r'^([mf])\.\s*(.*)', line, re.DOTALL)
            if gm:
                gender = gm.group(1)
                rest   = gm.group(2)
            else:
                gender = ''
                rest   = line
            # Headword = trailing Syriac token
            tm = re.search(r'\s([܀-ݏ]\S*)$', rest)
            if tm:
                current_hw     = tm.group(1)
                current_gender = gender
                current_rest   = rest[:tm.start()].strip()
            else:
                # Whole line is English with no clear Syriac headword — skip as noise
                pass

        elif kind == 'gender_start':
            flush()
            gm = re.match(r'^(\S+)\s+([mf])\.\s+(.*)', line, re.DOTALL)
            current_hw     = gm.group(1)
            current_gender = gm.group(2)
            current_rest   = gm.group(3)

        elif kind == 'garbled_only':
            flush()
            parts = line.split(None, 1)
            current_hw     = parts[0]
            current_gender = ''
            current_rest   = parts[1] if len(parts) > 1 else ''

        else:  # continuation
            if current_hw:
                current_rest = (current_rest + ' ' + line).strip()

    flush()
    return entries


def make_entry(headword, gender, rest):
    pos    = ''
    plural = ''

    syriac_ok = bool(SYRIAC_RE.search(headword))
    syriac    = headword if syriac_ok else '?'

    p = re.search(r'\(([nv]|adj|adv|num|conj|prep|pron|interj)\.?\)', rest)
    if p:
        pos = p.group(1)

    pl = re.search(r'\b[Pp][il]\.\s*([܀-ݏ]\S*)', rest)
    if pl:
        plural = pl.group(1)

    definition = SYRIAC_RE.sub('', rest)
    definition = re.sub(r'\b[Pp][il]\.\s*\S+', '', definition)
    definition = re.sub(r'\([nadvcpij][a-z]*\.?\)', '', definition)
    definition = re.sub(r'\bsee\s+\S+', '', definition, flags=re.IGNORECASE)
    definition = re.sub(r'[|\[\]{}\\#*¦£x7>}]+', '', definition)
    definition = re.sub(r'\s{2,}', ' ', definition).strip(' .,;:()/\\')

    return {
        'page':    '',
        'col':     '',
        'syriac':  syriac,
        'ocr_raw': headword,
        'garbled': '' if syriac_ok else 'yes',
        'gender':  gender,
        'pos':     pos,
        'plural':  plural,
        'english': definition,
        'raw':     rest,
    }


def main():
    doc = fitz.open(PDF_PATH)
    all_entries = []

    for i in range(len(doc)):
        page_num = i + 1
        print(f'Page {page_num}/{len(doc)}...', flush=True)
        for col_label, raw in ocr_columns(doc[i]):
            entries = parse_entries(raw)
            for e in entries:
                e['page'] = page_num
                e['col']  = col_label
            print(f'  Col {col_label}: {len(entries)} entries', flush=True)
            all_entries.extend(entries)

    total   = len(all_entries)
    garbled = sum(1 for e in all_entries if e['garbled'])
    print(f'\nTotal: {total}  |  Garbled headwords: {garbled}  |  Clean Syriac: {total - garbled}')

    with open(OUT_PATH, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'page', 'col', 'syriac', 'ocr_raw', 'garbled',
            'gender', 'pos', 'plural', 'english', 'raw'
        ])
        writer.writeheader()
        writer.writerows(all_entries)

    print(f'Saved → {OUT_PATH}')


if __name__ == '__main__':
    main()
