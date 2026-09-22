# Conversation log: rebuilding the SLR train schedule app

Saved 2026-09-21. Summary of the working session in which the legacy Struts/JSP app was scanned and rebuilt.
This is a written summary, not a verbatim transcript.

## 1. Requests, in order

1. **"Scan this folder."** The folder `railway/schedule` is the exploded WAR of the legacy **SLREnquiry** app (Struts 2.3.15.1, Spring 3.0.5, log4j 1.2.17, JSPs, jQuery). It has no Java source, only compiled classes.
2. **"Regenerate this application with a modern secure technology stack."** Chosen: **Next.js 15 + TypeScript**, in a **new sibling folder** (`railway/schedule-modern`). The legacy folder was not modified.
3. **"No need for a separate backend. I have a database on localhost, root, no password, db name `railway`."** The app should read the database directly instead of calling the old REST service. Investigation started (section 4); the rewrite is **not done yet**.
4. **"Save the conversation, where you build the new application."** This file.

## 2. What the legacy app did

- One search form: start station, end station, optional start/end time (30-minute slots plus 23:59:59), date (defaults to today).
- Rules: both stations required; stations must differ; start time must be before end time.
- Results: direct trains, connecting trains (expandable, transit legs marked **T**), ticket prices per class, total distance.
- If the backend answered status `2001` (nothing found), it asked for a junction suggestion ("Search A to J and then J to B").
- Languages: English, Sinhala, Tamil (`lang` parameter). Embedded in the Lanka Gate portal via `selectedTheme=countryportal`.
- All data came from a REST service at `http://192.168.4.26/trainschedule/...` (`station/getAll`, `ticket/getPrice`, `train/searchTrain`, `train/searchConnectingTrain`). The contract was recovered from the compiled classes with `javap`.

## 3. What was built (works today, against a mock REST API)

Location: `schedule-modern/`. Stack: Next.js 15.5, React 19, TypeScript strict, next-intl (en/si/ta), zod, Vitest.

- `src/lib/railway-api/` REST client, zod schemas, mappers (**to be replaced by a database layer**).
- `src/lib/validation.ts`, `dates.ts`, `times.ts`: shared browser/server rules; "today" in `Asia/Colombo`.
- `src/lib/search.ts`: search flow (search, junction hint on `2001`, prices and distance).
- `src/middleware.ts`: locale routing plus per-request **CSP nonce**; other headers in `next.config.ts`.
- `src/components/`, `src/app/[locale]/`: form, results, help dialog, language switcher, error and 404 pages.
- `messages/{en,si,ta}.json`: generated from the legacy `.properties` files; new UI strings are English-only.
- `mock-api/server.mjs`: invented sample data for development.
- `README.md`: run instructions, security notes, deliberate differences, go-live checklist.

Verification performed: typecheck, lint, 33 unit tests, `npm audit` (0 vulnerabilities; vitest 5 and a `postcss` override were needed), production build, HTTP checks (headers, nonce on all scripts, injection attempts rejected), and a headless-Chrome run of 17 checks with no console or CSP errors.

Not verifiable: the real REST backend (192.168.4.26) was unreachable.

## 4. Database findings so far (for the direct-database rewrite)

Server: MySQL 8.3 on `localhost:3306` (a MariaDB 11.3 also listens on 3307 but does not contain `railway`). Database `railway` is the **admin database of a CodeIgniter app** (`ci_sessions` exists), which was probably the source behind the old REST service. There are **no foreign keys**; relationships were inferred.

Tables that matter for the public search (row counts):

| Table | Role |
|---|---|
| `tbl_stationdetail` (490) | Stations. Names `Eng/Sin/Tam`, `Status`, `IsJunction`. 414 active. |
| `tbl_trainline` (12), `tbl_trainline_station` (741) | Lines and stations on each line (`TLSID`, `TLSOrder`). A timetable stop refers to a `TLSID`, not directly to a station. |
| `tbl_train` (1,939) | Train: `TrainNo`, names in 3 languages, `FrequencyID`, `TypeID`, `Status`, `IsOperation`. |
| `tbl_train_timetable` (1,924) | Timetable versions per train: `PublishDate`, `ExpireDate`, `FromID`/`ToID` (station IDs), `StartTime`/`EndTime`, `Direction`. |
| `tbl_train_timetable_detail` (71,472) | Stops per timetable: `TLSID`, `ArrivalTime`, `DepatureTime`, `IsStop`. |
| `tbl_frequancy` (443), `tbl_frequency_date` (1,236), `tbl_date` (7) | Weekday pattern per frequency; `tbl_date.SearchDay` 1=Sunday ... 7=Saturday (matches MySQL `DAYOFWEEK`). |
| `tbl_type` (44), `tbl_classtype` (3), `tbl_train_class` (3,137) | Train types (`IsPassenger`, `IsExpire`), classes, classes per train. |
| `tbl_connecting_train` (40) | Junction suggestions (`FromStID`, `ToStID`, `JunctionID`). |
| `tbl_train_connect_header` (217), `tbl_train_connect_detail` (436) | Predefined connecting journeys (`ConTID` to timetables `TTID`, `IsTransit`). |
| `tbl_station_distance` (113,834), `tbl_station_price` (232,518) | Precomputed distance and price per class (`StDisID`, `ClassTypeID`, `TPrice`). |

**Do not use / never read:** `tbl_users` (password hashes), `tbl_user_perms`, `tbl_role_*`, `tbl_perm_data`, `ci_sessions`. The app should connect with a dedicated **read-only** MySQL user limited to the tables above (production), not `root`.

Findings that change the design:

- `ExpireDate = '0000-00-00 00:00:00'` means **no expiry** (1,141 of 1,924 timetables). A plain date-range test finds zero active timetables today; treating the zero date as open-ended gives about 1,140.
- 4 timetables have a zero `PublishDate`. Latest publish date is 2026-05-30, so the data is current.
- `tbl_train.IsOperation` (1 vs 2) does **not** mean "currently running": Udaya Devi and Ruhunu Kumari are 1, Udarata Menike and Podi Menike are 2, and all run. Its meaning is unknown; it is indexed, which hints that the old search filtered on it.
- Stop order: sorting stops by `TTDetailID` gives a monotonic `TLSOrder` for 1,699 timetables but 234 are mixed (trains crossing lines). 368 timetables mention the same station twice (a station appears on several lines). Departure times are not non-decreasing in `TTDetailID` order for many timetables (could be midnight wrap or data quality). Not yet resolved.
- Frequencies are partly free text ("NOT ON SUNDAY & HOLIDAY", date-specific specials such as a Vesak special). The database has weekday rows only and no holiday calendar, so holidays cannot be honoured. 4 trains have a frequency with no weekday rows.
- `tbl_type.IsPassenger = 0` covers goods, service and RR trains; these should be excluded from a passenger search.

## 5. Open questions (need the owner's answer or the old source)

1. What does `tbl_train.IsOperation` mean, and should public search include both values?
2. How did the old REST service order stops and pick boarding/alighting stops (`IsStop = 1` only)? Use `TTDetailID` order or a different rule?
3. How should frequency be handled when it is not weekday-based (holidays, date-specific specials)?
4. How were connecting journeys chosen: from `tbl_train_connect_*` only, or computed via junctions?
5. Is the legacy CodeIgniter source (controllers `station`, `ticket`, `train`) available on this machine? It would answer 1-4 exactly. A disk search for it was started and **interrupted by the user**; nothing was searched or read.

## 6. Next steps

1. Answer the open questions (ideally from the original PHP source or a known-good set of routes and dates).
2. Replace `src/lib/railway-api/` with a `src/lib/db/` layer (`mysql2`, prepared statements, connection pool, `server-only`), configured by `DATABASE_URL` in `.env.local`. Keep the domain types in `types.ts` and the search flow in `search.ts`.
3. Add read-only user SQL (`db/readonly-user.sql`) and remove `RAILWAY_API_*` settings and the mock API.
4. Verify against known trains (for example Colombo Fort to Kandy on a weekday) and cross-check prices and distances with `tbl_station_price` / `tbl_station_distance`.
5. Update tests, README and this log.

## 7. Other decisions and caveats

- Stayed on Next 15 as chosen (Next 16 exists; upgrade path noted).
- ESLint 9 is flagged as unsupported by npm (dev-only); TypeScript pinned to 5.9 because 7.x is not what Next 15 targets.
- New UI strings (skip link, close, error labels, etc.) are English-only until translated; see `README.md`.
- Sinhala "Connecting Trains" heading was corrected (legacy copied "Direct Trains").
- Backend failure pages return HTTP 200 (error rendered inline).

---

## 8. Update (same day): rebuilt on the database, REST layer removed

**Requests since section 6**

5. *"What PHP app is needed for the Java application?"* None of the three. The Java app calls a separate REST service (`trainschedule`, source not provided); `railwaysearch` and `railwaydisplay` are alternative clients of the same service, and `railwaycms` is the admin app that edits the data.
6. *"Build with the new Next.js app the required module for the Java app. The admin CMS can remain separate for data updates."* Done: the app now reads the `railway` MySQL database directly.

**What the CodeIgniter source (`schedule/railwaycms`, `railwaysearch`, `railwaydisplay`) revealed**

- The original search service is **not** in those folders (the clients call `http://railway.lgcc.gov.lk/trainschedule/`). Rules were therefore derived from the CMS code and the data.
- `tbl_train.IsOperation`: **1 = RUN, 2 = CANCELED** (CMS labels). `tbl_train_timetable.Direction`: 1 = UP, 2 = DOWN.
- A timetable is in force when `PublishDate <= date` and `ExpireDate` is `'0000-00-00 00:00:00'` (no expiry) or `>= date`; the CMS forbids overlapping periods for one train.
- Stops are ordered by `TTDetailID`; the CMS forces the start station's departure to `StartTime` and the end station's to `EndTime`.
- Connections (`tbl_train_connect_*`) are chains of timetables of different trains where each leg ends where the next begins; `IsTransit` marks the change.
- Distances are stored once per station pair, so price lookups match both directions (as the CMS does). The price cron only maintains distance/price tables; it does not cancel trains.

**Implementation**

- `src/lib/db/` (`pool.ts`, `lang.ts`, `logic.ts`, `queries.ts`); removed `railway-api/` and `mock-api/`; new env `DATABASE_URL` (+ pool/timeout, `INCLUDE_CANCELED_TRAINS`).
- Database account file `db/readonly-user.sql` and optional `db/optional-indexes.sql` were written but **not executed** (the app currently uses the `root` login you supplied, from the git-ignored `.env.local`).
- Performance: the first version took about 1.4 s per search (bad join plan, unindexed price table); split into simple queries, now about 0.2 s, prices cached for 10 minutes.
- Found and fixed while testing: a `NaN` station id reached SQL (now rejected in the database layer); a mangled regex in my own patch script.

**Verification:** typecheck, lint, 45 tests (33 rule/validation + 12 against the real database), production build, and a 17-check headless-Chrome run against the real database with no console or CSP errors. `npm audit`: 0 vulnerabilities.

**Decision still needed:** the regular Colombo-Kandy and Colombo-Badulla trains (Podi Menike, Udarata Menike, Intercity) are marked CANCELED in the current data, so RUN-only search shows "no trains" for Colombo Fort to Kandy. Including CANCELED trains brings them back but also expired specials (2019 "April Season", "ON 11 & 13-01-2025"). If the main line runs, mark those trains RUN in the CMS.

**Other open items:** compare a few routes/dates with the live site; holidays and date-specific specials cannot be modelled from this schema; run `db/readonly-user.sql` and switch `DATABASE_URL` off `root`; translate the new UI strings for Sinhala and Tamil.
