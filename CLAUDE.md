# Dictionary Project

## Project Overview
Assyrian multilingual dictionary website — English, Assyrian (Syriac), Arabic, Farsi.

## Key Decisions
- Work directly on `main` branch (no worktrees)
- All files stay in the main project folder
- Spec: `docs/superpowers/specs/2026-04-20-assyrian-dictionary-design.md`
- Plan: `docs/superpowers/plans/2026-04-20-assyrian-dictionary.md`

## Stack
- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (PostgreSQL + pg_trgm) for database and search
- Vercel for hosting
- Python 3 for one-time data pipeline scripts

## Important Notes
- Syriac vowel points (U+0730–U+074A) must be stripped before search indexing
- Language auto-detected from Unicode script (Syriac / Arabic / Latin)
- Assyrian flag watermark: https://upload.wikimedia.org/wikipedia/commons/e/ef/Flag_of_the_Assyrians.svg
- Flag colors: `#003DA5` (blue), `#F7A800` (gold), `#D21034` (red)
- RTL text required for Assyrian, Arabic, Farsi
- No language selector tabs — auto-detect only
