'use client'

import { useState } from 'react'

type Lang = 'syriac' | 'arabic' | 'farsi'
type Row  = (string | null)[]   // null = empty/disabled key in this layer

// ── SYRIAC — matches audo12.keyman-touch-layout + audo12.kmn ─────────────
// Rows 1/2/3 mirror the Keyman 10 / 9 / 8-key layout (shift & bksp flank row 3)
const SYRIAC: { default: Row[]; shift: Row[] } = {
  default: [
    ['ܘܼܗܝ','ܨ','ܬ݂','ܩ','ܦ','ܓ݂','ܥ','ܗ','ܟ݂','ܚ'],  // q w e r t y u i o p
    ['ܫ','ܣ','ܝ','ܒ','ܠ','ܐ','ܬ','ܢ','ܡ'],            // a s d f g h j k l
    ['ܲ','ܛ','ܙ','ܪ','ܪ̈','ܕ','.','ܘܼ'],               // z x c v b n m .
  ],
  shift: [
    ['ܘܼܗ̇','̱',null,'ܿ','ܦ̮','݀','݁','̈','݇','̇'],
    ['ܫ̃','ܑ','ܝܼ','ܒ݂','ܠܵܐ','ܵܐ','ـ','ܐܝܼܬ','ܡ̣ܢ'],
    ['ܲ','ܵ','ܸ','ܹ','ܹܐ','ܬܵܐ','݂','؛'],
  ],
}

// ── ARABIC — covers all 28 Arabic letters across 3 rows ──────────────────
const ARABIC: { default: Row[]; shift: Row[] } = {
  default: [
    ['ض','ص','ث','ق','ف','غ','ع','ه','خ','ح'],
    ['ش','س','ي','ب','ل','ا','ت','ن','م','ك'],
    ['ج','د','ذ','ر','ز','ط','ظ','ء'],
  ],
  shift: [
    ['أ','إ','آ','ؤ','ئ','ة',null,null,null,null],
    [null,null,null,null,'لا',null,null,null,null,'و'],
    ['،','؟','؛','.','!',null,null,null],
  ],
}

// ── FARSI — Arabic base + پ چ ژ گ, with Farsi forms of ی and ک ────────
const FARSI: { default: Row[]; shift: Row[] } = {
  default: [
    ['ض','ص','ث','ق','ف','غ','ع','ه','خ','ح'],
    ['ش','س','ی','ب','ل','ا','ت','ن','م','ک'],
    ['پ','چ','ژ','ر','گ','ج','ء','و'],
  ],
  shift: [
    ['أ','إ','آ','ؤ','ئ','ة','ط','ظ','ذ',null],
    [null,null,null,null,'لا',null,null,null,null,'ز'],
    ['،','؟','؛','.','!',null,null,null],
  ],
}

const LAYOUTS = { syriac: SYRIAC, arabic: ARABIC, farsi: FARSI }

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

  const press = (ch: string | null) => {
    if (!ch) return
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
          {ri === 2 && (
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
              className={`kb-key${!ch ? ' kb-dim' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => press(ch)}
              disabled={!ch}
            >
              <span className="kb-char" style={{ fontFamily: font }}>
                {ch ?? ''}
              </span>
            </button>
          ))}

          {ri === 2 && (
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

      {/* Bottom row: space + optional enter */}
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
