'use client'

import { useState } from 'react'

const ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
]

// Mappings from audo12.kmn
const DEFAULT_MAP: Record<string, string> = {
  q: 'ܘܼܗܝ', w: 'ܨ',  e: 'ܬ݂', r: 'ܩ', t: 'ܦ', y: 'ܓ݂',
  u: 'ܥ',    i: 'ܗ',  o: 'ܟ݂', p: 'ܚ',
  a: 'ܫ',    s: 'ܣ',  d: 'ܝ',  f: 'ܒ', g: 'ܠ', h: 'ܐ',
  j: 'ܬ',    k: 'ܢ',  l: 'ܡ',
  z: 'ܲ',    x: 'ܛ',  c: 'ܙ',  v: 'ܪ', b: 'ܪ̈', n: 'ܕ', m: '.',
}

const SHIFT_MAP: Record<string, string> = {
  q: 'ܘܼܗ̇', w: '̱',   e: '',    r: 'ܿ',  t: 'ܦ̮',  y: '݀',
  u: '݁',    i: '̈',   o: '݇',  p: '̇',
  a: 'ܫ̃',   s: 'ܑ',   d: 'ܝܼ', f: 'ܒ݂', g: 'ܠܵܐ', h: 'ܵܐ',
  j: 'ـ',    k: 'ܐܝܼܬ', l: 'ܡ̣ܢ',
  z: 'ܲ',    x: 'ܵ',   c: 'ܸ',  v: 'ܹ',  b: 'ܹܐ',  n: 'ܬܵܐ', m: '݂',
}

interface Props {
  onKey: (char: string) => void
  onBackspace: () => void
}

export default function SyriacKeyboard({ onKey, onBackspace }: Props) {
  const [shifted, setShifted] = useState(false)
  const map = shifted ? SHIFT_MAP : DEFAULT_MAP

  const press = (k: string) => {
    const ch = map[k]
    if (ch) {
      onKey(ch)
      if (shifted) setShifted(false) // one-shot shift
    }
  }

  return (
    <div className="syriac-keyboard">
      {ROWS.map((row, ri) => (
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
          {row.map((k) => {
            const ch = map[k]
            return (
              <button
                key={k}
                className={`kb-key${!ch ? ' kb-dim' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => press(k)}
                disabled={!ch}
              >
                <span className="kb-syriac">{ch || ' '}</span>
                <span className="kb-hint">{k}</span>
              </button>
            )
          })}
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

      {/* Bottom row */}
      <div className="kb-row">
        <button
          className="kb-key kb-space"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onKey(' ')}
        >
          <span className="kb-hint">space</span>
        </button>
        {[
          { ch: 'ܘ',  hint: ',' },
          { ch: 'ܘܼ', hint: '.' },
          { ch: 'ܓ',  hint: "'" },
          { ch: 'ܟ',  hint: ';' },
        ].map(({ ch, hint }) => (
          <button
            key={hint}
            className="kb-key"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onKey(ch)}
          >
            <span className="kb-syriac">{ch}</span>
            <span className="kb-hint">{hint}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
