export interface Variant {
  id: number
  number: number
  assyrian: string
  assyrian_normalized: string
  arabic: string
  farsi: string | null
  example_assyrian: string | null
  example_arabic: string | null
}

export interface Entry {
  id: number
  english: string
  part_of_speech: string
  created_at: string
}

export interface SearchResult {
  id: number
  english: string
  part_of_speech: string
  variants: Variant[]
}
