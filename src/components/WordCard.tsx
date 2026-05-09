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

function LangCard({ label, labelClass, variants, textClass, field, phonetic }: {
  label: string
  labelClass: string
  textClass: string
  variants: Variant[]
  field: 'assyrian' | 'arabic' | 'farsi'
  phonetic?: boolean
}) {
  const texts = variants.map(v => ({ text: v[field], audio: v.audio_url, pron: v.pronunciation })).filter(v => v.text)

  return (
    <div className="lang-card">
      <div className={`lang-label ${labelClass}`}>{label}</div>
      {texts.length > 0 ? (
        <div className="d-flex flex-column gap-2">
          {texts.map((t, i) => (
            <div key={i}>
              <div className="d-flex align-items-center gap-1">
                <span dir="rtl" className={textClass}>{t.text}</span>
                {t.audio && <AudioButton url={t.audio} />}
              </div>
              {phonetic && t.pron && (
                <div style={{ fontSize: '0.8rem', color: '#9ca3af', fontFamily: 'monospace' }}>{t.pron}</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="translation-missing">Not yet translated</div>
      )}
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

        {/* Right: language cards */}
        <div className="col-12 col-md-8">
          <div className="d-flex flex-column gap-2">
            {LANGS.map(({ key, label, labelClass, textClass }) => (
              <LangCard
                key={key}
                label={label}
                labelClass={labelClass}
                textClass={textClass}
                variants={entry.variants}
                field={key}
                phonetic={key === 'assyrian'}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
