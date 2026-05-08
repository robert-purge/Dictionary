import type { SearchResult } from '@/types/dictionary'

interface Props { result: SearchResult | null }

export default function WordDetail({ result }: Props) {
  if (!result) {
    return (
      <div className="word-placeholder">
        Search for a word to see translations
      </div>
    )
  }

  return (
    <div className="word-detail">
      <h1 className="word-headword">{result.english}</h1>
      {result.part_of_speech && (
        <p className="word-pos">{result.part_of_speech}</p>
      )}
      <div className="flag-bar" />

      {result.variants.map((v, i) => (
        <div key={v.id}>
          {result.variants.length > 1 && (
            <p className="variant-label">Variant {v.number}</p>
          )}

          <div className="mb-4">
            <p className="lang-label lang-label-assyrian">Assyrian</p>
            {v.assyrian
              ? <p dir="rtl" className="font-assyrian translation-assyrian">{v.assyrian}</p>
              : <p className="translation-missing">No Assyrian translation</p>
            }
            {(v.pronunciation || v.audio_url) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                {v.pronunciation && (
                  <span style={{ fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic', fontFamily: 'monospace' }}>
                    {v.pronunciation}
                  </span>
                )}
                {v.audio_url && (
                  <button
                    onClick={async () => {
                      try {
                        const audio = new Audio(v.audio_url!)
                        await audio.play()
                      } catch {
                        // audio unavailable or CORS blocked — ignore silently
                      }
                    }}
                    title="Play pronunciation"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '2px 6px', borderRadius: '4px',
                      color: '#003DA5', fontSize: '1rem', lineHeight: 1,
                    }}
                  >
                    ▶
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mb-4">
            <p className="lang-label lang-label-arabic">Arabic</p>
            {v.arabic
              ? <p dir="rtl" className="font-arabic translation-arabic">{v.arabic}</p>
              : <p className="translation-missing">No Arabic translation</p>
            }
          </div>

          <div className="mb-4">
            <p className="lang-label lang-label-farsi">Farsi</p>
            {v.farsi
              ? <p dir="rtl" className="font-farsi translation-farsi">{v.farsi}</p>
              : <p className="translation-missing">Not yet available</p>
            }
          </div>

          {(v.example_assyrian || v.example_arabic) && (
            <div className="ps-3 border-start border-2 mt-3 mb-3" style={{ borderColor: '#f3f4f6' }}>
              {v.example_assyrian && (
                <p dir="rtl" className="font-assyrian text-muted text-end mb-1 small">{v.example_assyrian}</p>
              )}
              {v.example_arabic && (
                <p dir="rtl" className="font-arabic text-muted text-end small">{v.example_arabic}</p>
              )}
            </div>
          )}

          {i < result.variants.length - 1 && <hr className="variant-divider" />}
        </div>
      ))}
    </div>
  )
}
