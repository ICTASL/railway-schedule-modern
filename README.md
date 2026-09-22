# SLR Train Schedule (rewrite)

Public train-schedule search for Sri Lanka Railways, rebuilt from the legacy Struts 2 / JSP `SLREnquiry` WAR.
It reads the **railway MySQL database directly**; the old `trainschedule` REST service is no longer needed.
The PHP admin CMS (`railwaycms`) stays as it is and keeps maintaining the data.

**Stack:** Next.js 15 (App Router, React 19) · TypeScript (strict) · MySQL via `mysql2` · next-intl (English / සිංහල / தமிழ்) · zod · Vitest.
Node ≥ 20.19, MySQL 8 (queries avoid CTEs and window functions, so older servers should work too).

```
Browser ──► Next.js app ──► MySQL "railway"  ◄── railwaycms (PHP admin; edits the data)
```

## Run it

```bash
npm install
cp .env.example .env.local      # then set DATABASE_URL
npm run dev                     # http://localhost:3000
```

Production: `npm run build && npm start` (any Node ≥ 20.19 host, behind TLS).

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | **Required.** `mysql://user:password@host:3306/railway`. Use a read-only account (below). |
| `DATABASE_POOL_SIZE` / `DATABASE_QUERY_TIMEOUT_MS` | Optional, defaults 5 / 8000. |
| `INCLUDE_CANCELED_TRAINS` | `false` (default): only trains the CMS marks **RUN**. See "Decision needed". |
| `FRAME_ANCESTORS` | Origins allowed to embed the app (CSP). Default `'self' https://cp.lankagate.gov.lk`. |

Checks: `npm run typecheck && npm run lint && npm test`. The database tests in `tests/db.integration.test.ts` run
when `DATABASE_URL` is set (from `.env.local`) and are skipped otherwise.

## Database account (recommended)

`db/readonly-user.sql` creates a user with `SELECT` on only the 15 tables the search uses. The app never needs
`tbl_users`, `tbl_user_perms`, `tbl_role_*`, `tbl_perm_data` or `ci_sessions` (admin accounts and sessions) and
should not be able to read them. Additionally, every connection sets `SESSION TRANSACTION READ ONLY`.
The scripts in `db/` are for you to review and run; nothing in this project executes them.

`db/optional-indexes.sql` adds indexes for a few unindexed columns. Not needed (a search takes about 0.2 s today).

## How search works

Rules were derived from the CMS source (`railwaycms`) and the data; the original `trainschedule` service source was not available.

- **A train is offered on a date** when its timetable is published and not expired (`ExpireDate = '0000-00-00'` means no expiry, as in the CMS), the train is `Status = 1` and RUN (`IsOperation = 1`), its type is a passenger type, and its frequency (`tbl_frequency_date` weekdays) includes that weekday.
- **Direct trains:** the traveller boards at a stopping station (`IsStop = 1`) whose departure is inside the chosen time window, and gets off at a later stopping station. Stop order is the CMS's `TTDetailID` order.
- **Connecting trains:** chains defined in the CMS (`tbl_train_connect_*`): board on an earlier train, ride to the transfer station, continue on a later one. Every train in the chain must run that day. A chain is skipped when one train already covers the trip.
- **"No trains found":** the curated junction hint from `tbl_connecting_train` is shown when there is one.
- **Fares and distance:** `tbl_station_distance` / `tbl_station_price`, matched in either direction (distances are stored once per pair), one row per class.
- Names come in the chosen language, falling back to English when a translation is blank.

Code map: `src/lib/db/logic.ts` (pure rules, unit-tested) · `src/lib/db/queries.ts` (SQL) · `src/lib/search.ts` (flow) · `src/lib/validation.ts` (form rules, shared by browser and server).

## Decision needed: canceled trains

The CMS marks each train **RUN** (1) or **CANCELED** (2). In the current data, the regular **Colombo–Kandy and Colombo–Badulla** trains (Podi Menike, Udarata Menike, the Intercity services) are marked CANCELED, so with the default setting a search from Colombo Fort to Kandy returns "no trains" (20 timetables are hidden).
Setting `INCLUDE_CANCELED_TRAINS=true` shows them, **but also** expired specials that were marked CANCELED and never removed (for example a 2019 "April Season Special"). If the main line really is running, the fix belongs in the data (set those trains to RUN in the CMS), not in this app.

## Security

- **Dependencies:** no known vulnerabilities (`npm audit`); the legacy Struts 2.3 / log4j 1.x / Spring 3 stack is gone.
- **SQL:** every value is bound as a parameter; station ids must be plain positive integers (checked in the form, again on the server, and again in the database layer); the only text spliced into SQL is column names from a fixed allow-list. Tested with injection strings.
- **CSP with per-request nonce**, `frame-ancestors` from config, plus `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS, COOP; `X-Powered-By` removed.
- **Errors:** database problems are logged on the server and shown to visitors as a generic message. Configuration errors name the variable, never its value.
- **XSS:** React escapes output; translated markup uses rich-text tags, not `dangerouslySetInnerHTML`.
- **No cookies, no sessions, no third-party scripts.** The search form is read-only GET, so there is no CSRF surface.
- Keep `.env.local` out of version control (it is git-ignored).

## Deliberate differences from the legacy app

- Results are GET URLs (shareable); "Back" returns to the form with your values.
- The date defaults to today in Sri Lanka time (`Asia/Colombo`).
- A failing fare lookup or junction hint no longer turns the page into an error.
- Removed: Google+ share button (closed 2019), Sinhala/Tamil font-install links.
- Fixed: the Sinhala "Connecting Trains" heading was a copy of "Direct Trains".
- Accessibility basics: skip link, labelled controls, `aria-invalid`/`aria-describedby`, keyboard-operable dialog and toggles.

## Known limits and things to confirm

1. **Rules are inferred**, not copied from the old service. Compare a few routes and dates with the live site before go-live (the time window is applied to the departure from the boarding station; frequencies are weekday-based only).
2. **Holidays and date-specific specials** ("NOT ON SUNDAY & HOLIDAY", "ON 11 & 13-01-2025") cannot be honoured: the database has weekday patterns only and no holiday calendar. Expired specials are hidden by RUN-only, but a special that is RUN and open-ended would appear every matching weekday.
3. Four trains whose frequency has no weekday rows are never offered.
4. Some train names in the data are notes (for example "Stop at Beruwala on 18,19 & 20.01.2026 …"); they are shown as stored.
5. **Translations:** new UI strings are English-only and fall back to English (see `messages/en.json` keys under `common`, `error`, `notFound`, `search.select`, `search.errors.invalidDate|invalidTime`, `help.open`).
6. Share-link target (`SHARE_URL` in `src/lib/site.ts`) and the footer's "© 2011" text were carried over from the legacy pages.
7. Backend-failure pages return HTTP 200 (the error is rendered inline); monitor the server log or add a health check.

See `docs/CONVERSATION-LOG.md` for the history of how this was built and what the database looks like.
