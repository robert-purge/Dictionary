export interface Variant {
  id: number
  number: number
  assyrian: string | null
  assyrian_normalized: string | null
  arabic: string | null
  farsi: string | null
  example_assyrian: string | null
  example_arabic: string | null
}

export interface Entry {
  id: number
  english: string
  part_of_speech: string | null
  created_at: string
}

export interface SearchResult {
  id: number
  english: string
  part_of_speech: string | null
  variants: Variant[]
}
