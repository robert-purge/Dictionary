'use client'

import type { SearchResult, Variant } from '@/types/dictionary'

interface Props { entry: SearchResult }

const LANGS = [
  { key: 'assyrian' as const, label: 'Assyrian', labelClass: 'lang-label-assyrian', textClass: 'font-assyrian translation-assyrian' },
  { key: 'arabic'   as const, label: 'Arabic',   labelClass: 'lang-label-arabic',   textClass: 'font-arabic translation-arabic' },
  { key: 'farsi'    as const, label: 'Farsi',     labelClass: 'lang-label-farsi',    textClass: 'font-farsi translation-farsi' },
]

function AudioButton({ url }: { url: string }) {
  return (
    <button
      onClick={async () => {
        try { await new Audio(url).play() } catch { /* CORS / unavailable */ }
      }}
      title="Play pronunciation"
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '0 4px', fontSize: '0.9rem', opacity: 0.7, lineHeight: 1,
      }}
    >▶</button>
  )
}

function VariantGroup({ variant, number, showNumber }: { variant: Variant; number: number; showNumber: boolean }) {
  return (
    <div className="variant-group">
      {showNumber && (
        <div className="variant-label">Variant {number}</div>
      )}
      <div className="d-flex flex-column gap-2">
        {LANGS.map(({ key, label, labelClass, textClass }) => {
          const text = variant[key]
          return (
            <div key={key} className="lang-card">
              <div className={`lang-label ${labelClass}`}>{label}</div>
              {text ? (
                <div className="d-flex align-items-center gap-1">
                  <span dir="rtl" className={textClass}>{text}</span>
                  {key === 'assyrian' && variant.audio_url && (
                    <AudioButton url={variant.audio_url} />
                  )}
                </div>
              ) : (
                <div className="translation-missing">Not yet translated</div>
              )}
              {key === 'assyrian' && variant.pronunciation && (
                <div style={{ fontSize: '0.8rem', color: '#9ca3af', fontFamily: 'monospace', marginTop: '2px' }}>
                  {variant.pronunciation}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function WordCard({ entry }: Props) {
  return (
    <div className="word-card-row">
      <div className="row g-3">

        {/* Left: English word */}
        <div className="col-12 col-md-4">
          <div className="word-info-card">
            <div className="word-headword">{entry.english}</div>
            {entry.part_of_speech && <div className="word-pos">{entry.part_of_speech}</div>}
          </div>
        </div>

        {/* Right: one group of language cards per variant */}
        <div className="col-12 col-md-8">
          <div className="d-flex flex-column gap-3">
            {entry.variants.map((v, i) => (
              <VariantGroup
                key={v.id}
                variant={v}
                number={i + 1}
                showNumber={entry.variants.length > 1}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
