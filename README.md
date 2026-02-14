# Betsy's Commission Tracker

A full-stack web app to extract highlighted commission data from factory reports, store it in Supabase, and explore it via a dashboard and AI-powered chat.

## Quick Start

### 1. Set up Supabase

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor
2. Paste and run the contents of `supabase-migration.sql` (located in the project root)
3. This will drop any old tables and create the new schema with 4 factory seeds

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your keys:
- `NEXT_PUBLIC_SUPABASE_URL` — already set
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — already set
- `ANTHROPIC_API_KEY` — add your Claude API key (required for the chat feature only)

### 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

### Upload Reports
1. Go to **Upload Reports** in the nav
2. Select the factory (or let it auto-detect from the filename)
3. Drop your `.xlsx` or `.pdf` commission report
4. The system extracts only yellow-highlighted rows and shows a preview
5. Data is automatically saved to Supabase

### Dashboard
- View total sales, total commission, entry count
- See breakdowns by factory and customer
- Filter by report period (e.g., "OCT 2025")

### Chat
- Ask natural language questions about your commission data
- Examples: "How much did I sell to Nashville Office Interiors?", "Which factory had the highest sales?"
- Requires an Anthropic API key in `.env.local`

## Supported Factories

| Factory | Format | Auto-detect |
|---------|--------|-------------|
| HAT Commissions | Excel (.xlsx) | Filename contains "HAT" + "Commission" |
| MG | Excel (.xlsx) | Filename contains "MG" + "Commission" |
| DARRAN | PDF | Filename contains "DARRAN" |
| SYMPHONY | PDF | Filename contains "SYMPHONY" |

## Adding New Factories

1. Create a new parser in `src/lib/parsers/` (copy an existing one as template)
2. Implement the `detect()` and `normalize()` methods for the new column layout
3. Register it in `src/lib/parsers/registry.ts`
4. Add the factory to Supabase: `INSERT INTO factories (name, display_name, format) VALUES ('new_factory', 'New Factory', 'excel');`

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** for styling
- **ExcelJS** for Excel highlight detection
- **pdfjs-dist** for PDF annotation detection
- **Supabase** for database
- **Anthropic Claude** for AI chat
- **Recharts** for dashboard charts

## Deploy to Vercel

1. Push to GitHub
2. Import in [Vercel](https://vercel.com)
3. Add environment variables in Vercel settings
4. Deploy
