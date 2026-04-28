import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ܐܬܘܪܝܐ Dictionary',
  description: 'Assyrian · English · Arabic · Farsi multilingual dictionary',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Amiri&display=swap"
        />
        <link rel="stylesheet" href="/style.css" />
      </head>
      <body>
        {/* Assyrian flag watermark */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/e/ef/Flag_of_the_Assyrians.svg"
          alt=""
          aria-hidden="true"
          className="flag-watermark"
        />

        <div className="site-content">
          <nav className="site-nav d-flex justify-content-between align-items-center px-4 py-3 border-bottom">
            <div>
              <div className="nav-brand-title">
                ܐܬܘܪܝܐ <span style={{ color: 'var(--color-blue)' }}>Dictionary</span>
              </div>
              <div className="nav-brand-sub">Assyrian · English · Arabic · Farsi</div>
            </div>
            <div className="nav-brand-tagline d-none d-md-block">
              Type in any language — we&apos;ll figure it out
            </div>
          </nav>

          <main>{children}</main>
        </div>
      </body>
    </html>
  )
}
