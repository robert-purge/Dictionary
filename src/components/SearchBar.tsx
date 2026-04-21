'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  onSearch: (query: string) => void
}

export default function SearchBar({ onSearch }: Props) {
  const [value, setValue] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { onSearch(value) }, 200)
    return () => clearTimeout(timer.current)
  }, [value, onSearch])

  return (
    <div className="flex items-center gap-3 rounded-xl border-2 border-[#003DA5] bg-white/90 px-4 py-3 shadow-md">
      <span className="text-[#003DA5] text-lg">🔍</span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search in English, ܐܬܘܪܝܐ, عربي, or فارسی"
        className="w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-300"
        autoFocus
      />
    </div>
  )
}
