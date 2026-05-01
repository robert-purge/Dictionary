'use client'

import { useState } from 'react'

type Lang = 'syriac' | 'arabic' | 'farsi'

// No nulls — every entry is a real key. Shift/⌫ always flank the LAST row.
interface LangLayout {
  default: string[][]
  shift: string[][]
}

// ── SYRIAC ────────────────────────────────────────────────────────────────
// Default: all 22 base Syriac consonants (no diacritics) in 3 even rows,
//          plus . ܘܼ ܘܿ for usability.
// Shift:   soft variants (ܬ݂ ܓ݂ ܟ݂), diacritics, and all other audo12 chars.
const SYRIAC: LangLayout = {
  default: [
    ['ܨ','ܩ','ܦ','ܥ','ܗ','ܚ','ܓ','ܟ'],           // 8 base consonants
    ['ܫ','ܣ','ܝ','ܒ','ܠ','ܐ','ܬ','ܢ','ܡ'],         // 9 base consonants
    ['ܛ','ܙ','ܪ','ܕ','ܘ','.','ܘܼ','ܘܿ'],           // 5 base + . ܘ variants
  ],
  shift: [
    ['ܘܼܗ̇','̱','ܿ','ܦ̮','݀','݁','̈','݇','̇','̃'],    // diacritics (Q-P + ])
    ['ܫ̃','ܑ','ܝܼ','ܒ݂','ܠܵܐ','ܵܐ','ـ','ܐܝܼܬ','ܡ̣ܢ','̣'],  // diacritics (A-L + ;)
    ['ܲ','ܵ','ܸ','ܹ','ܹܐ','ܬܵܐ','݂','،','؛','ܠܹܐ','؟'],  // diacritics + punct
    ['ܬ݂','ܓ݂','ܟ݂','ܪ̈','ܓ̰','ܟ̰','ܲܝܗܝ'],            // soft variants + extras
  ],
}

// ── ARABIC — all 28 letters + ء in 3 rows ────────────────────────────────
const ARABIC: LangLayout = {
  default: [
    ['ض','ص','ث','ق','ف','غ','ع','ه','خ','ح'],
    ['ش','س','ي','ب','ل','ا','ت','ن','م','ك'],
    ['ج','د','ذ','ر','ز','ط','ظ','ء'],
  ],
  shift: [
    // Hamza variants + lam-alef ligature
    ['أ','إ','آ','ؤ','ئ','ة','لا','و'],
    // Punctuation row (flanked by shift + bksp)
    ['،','؟','؛','.','!'],
  ],
}

// ── FARSI — all 32 letters across 4 rows ─────────────────────────────────
// Row 1-2: same as Arabic (with Farsi ی and ک)
// Row 3: Farsi-specific letters پ چ ژ گ + shared ج ء و
// Row 4: remaining Arabic-origin letters د ذ ز ط ظ  (flanked by shift + bksp)
const FARSI: LangLayout = {
  default: [
    ['ض','ص','ث','ق','ف','غ','ع','ه','خ','ح'],   // 10
    ['ش','س','ی','ب','ل','ا','ت','ن','م','ک'],   // 10 — Farsi ی ک
    ['پ','چ','ژ','ر','گ','ج','ء','و'],            //  8 — Farsi-specific + shared
    ['د','ذ','ز','ط','ظ'],                         //  5 — remaining letters (last row → gets shift + bksp)
  ],
  shift: [
    // Hamza variants
    ['أ','إ','آ','ؤ','ئ','ة','لا','ز'],
    // Punctuation (last row → flanked by shift + bksp)
    ['،','؟','؛','.','!'],
  ],
}

const LAYOUTS: Record<Lang, LangLayout> = { syriac: SYRIAC, arabic: ARABIC, farsi: FARSI }

const LANG_META: Record<Lang, { tab: string; font: string }> = {
  syriac: { tab: 'ܐ Syriac', font: "'Audo', serif" },
  arabic: { tab: 'ع Arabic', font: "'Amiri', 'Traditional Arabic', serif" },
  farsi:  { tab: 'ف Farsi',  font: "'Amiri', 'Tahoma', sans-serif" },
}

interface Props {
  onKey: (ch: string) => void
  onBackspace: () => void
  onEnter?: () => void
}

export default function OnScreenKeyboard({ onKey, onBackspace, onEnter }: Props) {
  const [lang, setLang]       = useState<Lang>('syriac')
  const [shifted, setShifted] = useState(false)

  const { default: defRows, shift: shiftRows } = LAYOUTS[lang]
  const rows = shifted ? shiftRows : defRows
  const { font } = LANG_META[lang]
  const lastRowIdx = rows.length - 1   // shift + bksp always flank the final row

  const press = (ch: string) => {
    onKey(ch)
    if (shifted) setShifted(false) // one-shot shift
  }

  return (
    <div className="osk-panel">
      {/* Language switcher */}
      <div className="osk-tabs">
        {(Object.keys(LANG_META) as Lang[]).map((l) => (
          <button
            key={l}
            className={`osk-tab${lang === l ? ' active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setLang(l); setShifted(false) }}
          >
            {LANG_META[l].tab}
          </button>
        ))}
      </div>

      {/* Letter rows */}
      {rows.map((row, ri) => (
        <div key={ri} className="kb-row">
          {ri === lastRowIdx && (
            <button
              className={`kb-key kb-wide${shifted ? ' kb-active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShifted((s) => !s)}
            >
              ⇧
            </button>
          )}

          {row.map((ch, ci) => (
            <button
              key={ci}
              className="kb-key"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => press(ch)}
            >
              <span className="kb-char" style={{ fontFamily: font }}>{ch}</span>
            </button>
          ))}

          {ri === lastRowIdx && (
            <button
              className="kb-key kb-wide"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onBackspace}
            >
              ⌫
            </button>
          )}
        </div>
      ))}

      {/* Bottom control row */}
      <div className="kb-row">
        <button
          className="kb-key kb-space"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onKey(' ')}
        >
          <span className="kb-hint">space</span>
        </button>
        {onEnter && (
          <button
            className="kb-key kb-wide"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onEnter}
            style={{ fontSize: '1.1rem' }}
          >
            ↵
          </button>
        )}
      </div>
    </div>
  )
}
