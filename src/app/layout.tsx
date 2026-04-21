import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ܐܬܘܪܝܐ Dictionary',
  description: 'Assyrian · English · Arabic · Farsi multilingual dictionary',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="relative min-h-screen bg-[#f9f9f7] overflow-hidden">

        {/* Assyrian flag as full-page watermark */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/e/ef/Flag_of_the_Assyrians.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 h-full w-full object-cover opacity-10 select-none"
        />

        {/* Navbar */}
        <nav className="relative z-10 flex items-center justify-between border-b border-gray-200 bg-white/95 px-8 py-4 backdrop-blur-sm">
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">
              ܐܬܘܪܝܐ <span className="text-[#003DA5]">Dictionary</span>
            </h1>
            <p className="text-[9px] uppercase tracking-widest text-gray-400 mt-0.5">
              Assyrian · English · Arabic · Farsi
            </p>
          </div>
          <p className="hidden md:block text-xs italic text-gray-300">
            Type in any language — we&apos;ll figure it out
          </p>
        </nav>

        <main className="relative z-10">{children}</main>
      </body>
    </html>
  )
}
