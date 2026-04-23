import type { SearchResult } from '@/types/dictionary'

interface Props { result: SearchResult | null }

export default function WordDetail({ result }: Props) {
  if (!result) {
    return (
      <div className="flex items-center justify-center h-full text-gray-300 text-sm">
        Search for a word to see translations
      </div>
    )
  }

  return (
    <div className="p-8 pb-16">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-1">{result.english}</h1>
      {result.part_of_speech && (
        <p className="text-xs text-gray-400 mb-4">{result.part_of_speech}</p>
      )}
      <div className="h-0.5 w-28 bg-gradient-to-r from-[#003DA5] via-[#F7A800] to-[#D21034] rounded mb-6" />

      {result.variants.map((v, i) => (
        <div key={v.id} className="mb-6">
          {result.variants.length > 1 && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
              Variant {v.number}
            </p>
          )}

          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#003DA5] mb-1">Assyrian</p>
            <p dir="rtl" className="text-lg text-[#003DA5] leading-relaxed text-right">{v.assyrian}</p>
          </div>

          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#D21034] mb-1">Arabic</p>
            <p dir="rtl" className="text-base text-[#D21034] leading-relaxed text-right">{v.arabic}</p>
          </div>

          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Farsi</p>
            {v.farsi
              ? <p dir="rtl" className="text-base text-gray-900 leading-relaxed text-right">{v.farsi}</p>
              : <p className="text-xs text-gray-300 italic">Not yet available</p>
            }
          </div>

          {(v.example_assyrian || v.example_arabic) && (
            <div className="pl-4 border-l-2 border-gray-200 mt-3">
              {v.example_assyrian && (
                <p dir="rtl" className="text-sm text-gray-500 text-right mb-1">{v.example_assyrian}</p>
              )}
              {v.example_arabic && (
                <p dir="rtl" className="text-sm text-gray-500 text-right">{v.example_arabic}</p>
              )}
            </div>
          )}

          {i < result.variants.length - 1 && <hr className="my-6 border-gray-100" />}
        </div>
      ))}
    </div>
  )
}
