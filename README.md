# OmniProfile

A professional identity vault that fills job applications for you.

Upload a PDF CV → AI parses it into a structured profile → review and save it →
on a supported ATS (Workday, Greenhouse, Lever, Taleo) the Chrome extension maps
your profile onto the form with one click.

## Repository layout

| Path | What it is |
| --- | --- |
| `apps/web` | Next.js 16 app (App Router): the vault UI, auth, and the API |
| `apps/extension` | Manifest V3 Chrome extension: popup, service worker, content script |
| `packages/shared` | Zod schemas and types shared by both (profile, field mapping, API contracts) |
| `supabase/migrations` | Postgres schema and row-level-security policies |

## Setup

Requires Node 22.18+, a [Supabase](https://supabase.com) project and an OpenAI API key.

1. **Install**

   ```sh
   npm install
   ```

2. **Database** – apply `supabase/migrations/20261112000000_init.sql` to your Supabase
   project (`supabase db push`, or paste it into the SQL editor).

3. **Auth** – in Supabase → Authentication → URL Configuration, set the Site URL to
   `http://localhost:3000` and add `http://localhost:3000/auth/callback` as a redirect URL.
   Email + password sign-in is used. For quick local testing you can turn off
   "Confirm email".

4. **Environment** – copy `apps/web/.env.example` to `apps/web/.env.local` and fill it in.

5. **Run the web app**

   ```sh
   npm run dev
   ```

6. **Build and load the extension**

   ```sh
   npm run build:extension
   ```

   Open `chrome://extensions`, enable Developer mode, choose **Load unpacked** and select
   `apps/extension/dist`. Click the extension icon → **Connect account**.

   To point the extension at a deployed app, build with
   `OMNIPROFILE_API_URL=https://your-app.example.com`, and add the extension's ID to
   `EXTENSION_ALLOWED_IDS` on the server (required in production).

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Web app dev server |
| `npm run dev:extension` | Rebuild the extension on change |
| `npm run build` | Production build of both apps |
| `npm run typecheck` | Type-check every workspace |
| `npm run lint` | ESLint (web) |
| `npm test` | Unit tests (shared mapping and schema logic) |

## How it works

### CV parsing
`POST /api/profile/parse` extracts the PDF's text in memory (`unpdf`), sends it to
`gpt-4o` in JSON mode, and validates the result against `candidateProfileSchema`.
The draft is returned to the browser for review; nothing is saved until the user
presses **Save profile**. The PDF itself is never stored.

### Extension sign-in
OAuth 2.0 authorization-code flow with PKCE via `chrome.identity.launchWebAuthFlow`:

1. The extension opens `/extension/authorize` with a `code_challenge` and `state`.
2. The signed-in user approves; the server redirects to
   `https://<extension-id>.chromiumapp.org/` with a single-use code (2-minute lifetime).
3. The service worker exchanges code + verifier at `POST /api/extension/token` for an
   opaque access token (30 days), stored in `chrome.storage.local`.

Only SHA-256 hashes of codes and tokens are stored server-side.

### Auto-fill
1. The content script scrapes empty, visible `<input>`, `<select>` and `<textarea>`
   controls (grouping radios and checkboxes into one question) with their labels.
2. The service worker posts the field list to `POST /api/extension/map`. The server loads
   the profile and asks `gpt-4o-mini` (JSON mode) for a value and confidence per field.
3. `reconcileMapping` validates the answer: unknown refs are dropped, choice values must
   match a real option, and anything below 0.7 confidence is discarded.
4. The content script injects values through native setters and dispatches
   focus / input / change / blur events so React, Angular and Vue forms register them.
5. Anything not filled is left blank, outlined on the page, and listed in the panel.
   The application is logged to the tracker. **Nothing is ever submitted automatically.**

## Privacy and security notes

- Logs carry only counts, durations and error class names (`lib/logger.ts`). CV text,
  profile data, form values and model output are never logged, and OpenAI error
  messages are dropped because they can echo request content.
- The full profile never reaches the extension. It receives only the values chosen for
  fields on a supported ATS page, and the page URL is taken from the browser, not the page.
- The extension requests host access to the OmniProfile API only; ATS pages are reached
  through content scripts on a fixed list of hosts.
- Demographic and legal questions (gender, ethnicity, veteran, disability, sponsorship,
  clearance) are only filled from answers the user typed into the vault. They are never inferred.
- Profile and application tables are protected by row-level security. The extension token
  tables have RLS enabled with no policies, so only the server's secret key can read them.

## Known limitations (MVP)

- Custom dropdown widgets that are not real `<select>` elements (common in Workday) are
  not filled; they are simply not detected, so check those by hand.
- File inputs cannot be filled by an extension, so the CV must be attached manually.
- Scanned / image-only PDFs are rejected (no OCR).
- Fields inside shadow DOM are not scraped.
- No rate limiting on the AI endpoints yet. Add it before a public launch.
