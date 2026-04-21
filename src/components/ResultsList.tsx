import type { SearchResult } from '@/types/dictionary'

interface Props {
  results: SearchResult[]
  selected: SearchResult | null
  onSelect: (result: SearchResult) => void
}

export default function ResultsList({ results, selected, onSelect }: Props) {
  if (results.length === 0) {
    return (
      <p className="text-center text-sm text-gray-300 mt-8">
        No results — try a different word
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {results.map((r) => (
        <div
          key={r.id}
          data-selected={r.id === selected?.id ? 'true' : 'false'}
          onClick={() => onSelect(r)}
          className={`cursor-pointer rounded-lg border px-4 py-3 transition-all border-l-4
            ${r.id === selected?.id
              ? 'border-gray-200 border-l-[#F7A800] bg-white'
              : 'border-gray-200 border-l-[#003DA5] bg-white/80 hover:bg-white'
            }`}
        >
          <p className="font-bold text-gray-900">{r.english}</p>
          {r.part_of_speech && (
            <p className="text-xs text-gray-400 mt-0.5">{r.part_of_speech}</p>
          )}
        </div>
      ))}
    </div>
  )
}
