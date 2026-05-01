'use client'

import { useState } from 'react'

type Lang = 'syriac' | 'arabic' | 'farsi'

// No nulls — every entry is a real key. Shift/⌫ always flank the LAST row.
interface LangLayout {
  default: string[][]
  shift: string[][]
}

// ── SYRIAC — matches audo12 Keyman layout (all keys) ────────────────────
const SYRIAC: LangLayout = {
  default: [
    ['ܘܼܗܝ','ܨ','ܬ݂','ܩ','ܦ','ܓ݂','ܥ','ܗ','ܟ݂','ܚ','ܓ̰','ܟ̰'],  // Q W E R T Y U I O P [ ]
    ['ܫ','ܣ','ܝ','ܒ','ܠ','ܐ','ܬ','ܢ','ܡ','ܟ','ܓ'],              // A S D F G H J K L ; '
    ['ܲ','ܛ','ܙ','ܪ','ܪ̈','ܕ','.','ܘ','ܘܼ','ܘܿ','ܲܝܗܝ'],         // Z X C V B N M , . / `
  ],
  shift: [
    // Q W [skip E] R T Y U I O P ]
    ['ܘܼܗ̇','̱','ܿ','ܦ̮','݀','݁','̈','݇','̇','̃'],
    // A S D F G H J K L ;
    ['ܫ̃','ܑ','ܝܼ','ܒ݂','ܠܵܐ','ܵܐ','ـ','ܐܝܼܬ','ܡ̣ܢ','̣'],
    // Z X C V B N M , . / \
    ['ܲ','ܵ','ܸ','ܹ','ܹܐ','ܬܵܐ','݂','،','؛','ܠܹܐ','؟'],
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
