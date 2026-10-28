# Project progress log

A from-the-start record of what PokéMed is, what was built, what was tested, and what is
still open. Started 2026-10-27; updated 2026-10-29.

| | |
|---|---|
| Live demo | https://pokemed.vercel.app |
| Pitch deck | `Poke-Med-Dexathon-2026.pdf` |
| Submission text | [`docs/SUBMISSION.md`](SUBMISSION.md) |
| Presentation | [`docs/PITCH.md`](PITCH.md) |
| Caregiver PIN | `2468` — elder never signs in, the phone is added by scanning a QR code |

---

## Status against the pitch deck

| Deck promise | State |
|---|---|
| Photo or typed Rx → reviewed schedule | Built and tested |
| Elder screen: one big **Taken** button, voice in Tamil / Hindi / English | Built and tested (see the audio test below) |
| Missed-dose alert, one-tap nudge, weekly adherence report | Built |
| Confidence score per medicine, "not sure, ask your pharmacist" | **Built** — rule-based read-confidence chip on every review row, 4 unit tests, low-score pharmacist wording |
| Reads a handwritten Rx photo | **Built, opt-in** — local Donut OCR service; without `OCR_SERVICE_URL` it falls back to a vision key, then browser OCR |
| Drug data: RxNorm + openFDA | **Partly done** — real Indian products and a DrugBank extract are in; RxNorm/openFDA normalisation is still next |
| Indian brand → generic map (Dolo = paracetamol) | Built — 135,121 brand tokens, 1,679 salts |
| Database: PostgreSQL | **Open** — state is a JSON file locally, Vercel Blob when deployed |
| Decision support, not medical advice | Built into copy, flags and README |
| Runs on free tiers | Vercel free tier ✓; vision model pending a key |

---

## Timeline

### 2026-10-22 — the working prototype (4 commits, ~8,200 lines added)

**`b08e0b6` PokeMed: medication companion for elders and their families**
60 files in one commit — the whole first version:

- **Reading a prescription**: `POST /api/scan`, `lib/parse/sig.ts` shorthand decoding
  (`1-0-1`, `BD`, `TDS`, `HS`, `SOS`, `PC`, `AC`, `7 AM`, `8hrly`, `x 30 days`, `½`),
  brand → salt map (`lib/data/brands.ts`), hospital-only lines (IV/IM/injections) reported
  separately and never scheduled.
- **Screens**: caregiver dashboard, upload with a draggable crop, review-before-save,
  schedule, weekly report, clash flags, elder phone screen.
- **Safety**: `lib/checks.ts` — duplicate active ingredient, therapeutic duplication, and a
  short curated risky-pair list with a named source for each.
- **Demo clock**: `POST /api/demo` jumps to the next dose or past the grace window so a
  judge can see a missed dose in seconds.
- **Tooling**: `scripts/smoke.mjs`, `scripts/selftest.ts`, `scripts/shots.mjs`
  (regenerates every screenshot in `docs/`), `scripts/ocr-test.mjs`.

**`867f6fd` Separate PIN sign-in for the elder and the caregiver**
Login screen with a keypad, scrypt PIN hashing (`lib/auth-hash.ts`), signed session tokens
(`lib/auth-token.ts`), logout/me routes, and `middleware.ts` protecting every route.

**`78d022d` Choose a person before the PIN pad, and make switching easy**
Person chooser on the sign-in screen, quick switching between caregiver and elder views.

**`0810e88` Read photos with a crop, and keep hospital-only lines off the schedule**
Drag-a-box crop on the upload screen with a two-pass browser OCR (cropped region, then whole
page), plus the first OCR tooling: `scripts/ocr-bench.mjs` (runs the real upload screen over a
folder of photos) and `scripts/ocr-lab.mjs`.

### 2026-10-26 — QR pairing and the security pass (5 commits)

**`88c407f` Keep the elder off the PIN pad and finish QR pairing**
The design decision that shaped the app: **an elder never types a PIN.** Added
`/api/pair/create`, `/api/pair/[token]`, `/api/pair/devices`, `lib/pairing.ts`,
`/pair/invalid`, plus loading skeletons, toasts and error/404 pages.

**`393e926` Close the security gaps found in review**
Login throttling, `lib/elder-guard.ts` (revocation check on elder requests), upload size and
type limits, cookie hardening.

**`b14394f` Point pairing QR codes at an address a phone can reach**
`lib/origin.ts` rewrites loopback hosts to the machine's LAN IPv4 (prefers `192.168`, then
`10.x`, then `172.16/12`), so a QR scanned by a phone on the same Wi-Fi actually opens.

**`a3881ea` Show paired devices as soon as a phone pairs**
Devices persist across restarts and appear immediately, with per-device revocation.

**`8c38f38` Close the remaining gaps: real secret, CSP, no dead doors**
`scripts/ensure-secret.mjs` generates a per-machine `AUTH_SECRET` into `.env.local`,
`next.config.mjs` gained the CSP and security headers, `POST /api/nudge` made the "Send a
nudge" button real, dead routes removed.

### 2026-10-27 — submission pack and production (3 commits)

**`e9c129b` Add a ready-to-paste submission pack** → `docs/SUBMISSION.md`

**`f5123e5` Store state in Vercel Blob when deployed**
Vercel's runtime filesystem is read-only and each request can land on a different instance,
so:

- `lib/blob.ts` reads/writes a **private** Vercel Blob when `BLOB_STORE_ID` is present and
  falls back to the existing files locally — local runs and tests are unchanged.
- Pairing tokens, paired devices and revocations live in one document, so a QR created on
  one instance can be redeemed on another and a removed phone stays removed.
- `readDB` became async (six call sites) with a 1-second cache in blob mode.
- The missed-dose sweep now runs *inside* the mutation that moves the demo clock, so alerts
  are persisted instead of living only in memory.
- Deleted `lib/api-handler.ts` — unused, and its hardcoded CSP would have overridden the real one.

**`a73a591` Point the docs at the live deployment**

**Deployment**

| | |
|---|---|
| Project | `pokemed`, linked to the source repository (pushes to `main` auto-deploy) |
| Storage | private Blob store, connected via OIDC (`BLOB_STORE_ID`, `BLOB_WEBHOOK_PUBLIC_KEY`) |
| Secrets | `AUTH_SECRET` (production + preview, marked secret), `POKEMED_TRUST_PROXY=1` so login throttling uses the real client IP |
| Verified live | login → state → create pairing link → redeem → device list → elder state → nudge → revoke → revoked device `401`; browser login keypad, dashboard, **zero console errors** |

### 2026-10-28 — real drug data and handwriting OCR

**`Indian Medicine Dataset` (MIT) — `junioralive/Indian-Medicine-Dataset`**

- Parsed all **253,973** products (**251,100** usable) into **135,121** brand tokens and
  **1,679** salts. The CSV is malformed (unquoted commas inside composition cells), so the
  builder splits the first seven columns and treats the rest as composition.
- Combination families were the trap: `Ecosprin AV` and plain `Ecosprin` share a first token.
  The builder now prefers each brand's **plain** products (brand + strength/form) when choosing
  its composition, so `Ecosprin` stays aspirin, `Glycomet` stays metformin and `Telma` stays
  telmisartan. `Ecosprin-AV` keeps its own aspirin + atorvastatin entry. Ambiguous tokens fell
  from 4,779 to **987**.
- Generated data is committed as raw text modules (`lib/data/generated/`) so deploys never need
  the 45 MB downloads and `tsc` never infers a 135k-key object literal.
- `scripts/fetch-data.mjs` downloads with size/checksum checks and resume;
  `scripts/build-drug-index.mjs` rebuilds. Raw files live in `data/external/` (git-ignored).

**`DrugBank 5.1 DDI extract` (CC BY 4.0, Yu 2020) — Mendeley `md5czfsfnd`**

- **222,696** rows → **58,522** usable salt pairs after keeping only salts present in the
  Indian product set and dropping the two non-specific interaction types
  (`risk or severity of adverse effects`, `therapeutic efficacy`) that would otherwise
  raise a vague flag for almost every pair. British/Indian spellings are canonicalised
  (`amoxycillin` → `amoxicillin`, `paracetamol` ↔ `acetaminophen`, `clavulanic acid` →
  `clavulanate`).
- `lib/checks.ts` gained a fourth check: one flag per pair of medicines, capped at 12, sorted by
  severity. Curated rules always win, so a pair is never double-reported.
- The dataset has **no severity column**; severity is inferred from the interaction wording
  (bleeding, arrhythmia, serotonin, rhabdomyolysis… → higher priority) and the flag says so,
  citing the DOI instead of pretending to be licensed DrugBank data.
- The live DrugBank checker is a commercial API (severity, evidence, management text); it is not
  usable without a licence, so it is documented as a future upgrade, not wired in.

**Handwriting OCR — `services/ocr`**

- FastAPI service around `chinmays18/medical-prescription-ocr` (Donut-base, MIT, ~0.2B params,
  reported 71% character / 84% word accuracy). Lazy model load, `/health`, optional shared key,
  8 MB cap, CPU Dockerfile with an optional weight bake.
- `/api/scan` now tries `OCR_SERVICE_URL` first, then `OPENAI_API_KEY`, then returns
  `needs-text` for the browser Tesseract fallback. Unexported or unreachable service → clean
  fallback, no invented medicines.
- The 0.2B-parameter model stays out of the Vercel function; the hosted demo is unchanged when
  the env var is unset.

**Data scripts and tests**

- `npm run data:fetch`, `npm run data:build`, `npm run data:all`.
- `npm test` grew from 22 to **31** checks: real brand lookups, plain-vs-variant behaviour, the
  near-miss suggestion, a DrugBank-sourced flag and curated-pair de-duplication.
- `npx tsc --noEmit` clean; `npm run build` clean; `node scripts/vision-test.mjs` **12/12**.

---

## Test record — 2026-10-27

### 1. Vision / OCR API — 12/12

Run: `node scripts/vision-test.mjs` (server must be running on `:3000`)

| Check | Result |
|---|---|
| Caregiver sign-in | pass |
| Text path parses shorthand — `1-0-1` → morning + night (2 times) | pass |
| `before food` relation parsed | pass |
| Hospital-only `Inj … IV` line separated into `ignored`, not scheduled | pass |
| Empty text rejected `400` | pass |
| Image upload accepted | pass |
| No vision key → `mode: needs-text`, honest message, **zero medicines invented** | pass |
| Non-image file rejected `415` | pass |
| File over 8 MB rejected `413` before being read | pass |

### 2. Browser end-to-end (real upload screen, Tesseract) — pass

Loaded `public/sample-prescription.png` through the actual UI and read it:

- Extracted **Dolo 650 mg, Ibuprofen 400 mg, Metformin 500 mg**
- Shorthand correctly decoded: `1-1-1 PC` → 8:00/13:00/20:00, `BD PC`, `1-0-1 PC`, `x 3 days`, `x 30 days`
- Landed on `/review` with all three editable, **zero console errors**

### 3. Elder screen audio — pass

Paired a phone through the real QR link (`http://<LAN-IP>:3000/api/pair/…` → `/elder`),
then drove every audio path:

| Check | Result |
|---|---|
| QR link opens the elder screen | pass |
| `speechSynthesis` present, 5 voices (`en-US`, `en-IN`) | pass |
| Auto-speak when a dose is due — *"Time for your medicine. Metformin. 500 mg. 1 tablet. after food."* with **Microsoft Ravi (English India)** | pass |
| **Say again** repeats the dose | pass |
| **Taken** speaks *"Well done"* and shows the confirmation | pass |
| Voice toggle **off** → 0 utterances | pass |
| Switch to **தமிழ்** → no Tamil voice installed → falls back to English **and** shows *"This device has no Tamil/Hindi voice installed — reading in English."* | pass |
| Console | only a COOP-header warning on the plain-HTTP LAN origin (expected; ignored on the HTTPS deployment) |

### 4. Regression suites

- `node scripts/smoke.mjs` → **36/36**
- `npm run test` → **35/35**
- `npx tsc --noEmit` → clean; `npm run build` → clean

### 5. Real-data and interaction suite — 2026-10-28

| Check | Result |
|---|---|
| `npm run data:build` over 253,973 products + 222,696 DDI rows | 135,121 tokens, 1,679 salts, 58,522 pairs |
| `Dolo` → paracetamol; `Combiflam` → ibuprofen + paracetamol | pass |
| `Augmentin` → amoxicillin + clavulanate | pass |
| Plain brand not polluted by a combination variant (`Ecosprin` → aspirin, `Glycomet` → metformin) | pass |
| `Ecosprin-AV` keeps aspirin + atorvastatin | pass |
| Unknown token kept but marked for review; typo `Ecosprln` suggests `Ecosprin` | pass |
| Metformin + cimetidine raises a DrugBank-sourced flag (serum concentration) | pass |
| Curated ibuprofen + aspirin is not duplicated by the dataset | pass |
| `npm run test` | **35/35** |
| `npx tsc --noEmit` / `npm run build` | clean |
| `node scripts/vision-test.mjs` (no OCR service configured) | **12/12**, honest `needs-text` fallback |

### 6. Completion, privacy and security pass — 2026-10-29

**Confidence and review**

- Every review row now shows a rule-based **read-confidence** chip (`97%` for a clear printed line, lower when the
  timing is missing or the brand is unknown), with four unit tests. A low score says *"Not sure about this line? Ask
  your pharmacist before saving."*
- Fixed the upload-preview race: the selected photo now reaches the review screen even when the file picker and the
  read button are used back-to-back. The browser E2E suite asserts the photo is still on review.
- Added a low-confidence sample path to the E2E suite; the sample still produces three editable medicines.

**Security and privacy**

- **Found and fixed a real data leak:** `/api/state` returned the caregiver's scrypt `pinHash` to every signed-in
  client, including the elder's phone. The response now uses `PublicPerson`, which strips it before serialisation.
- **Removed the published `AUTH_SECRET` fallback.** Production now fails closed if the secret is missing; the npm
  scripts generate a per-machine secret in `.env.local` for local use.
- **Pairing QR is generated locally** with `qrcode` as a data URL. The single-use pairing token is no longer sent to
  `api.qrserver.com`; the CSP no longer allows that origin.
- **Upload and body hardening:** an 8 MB cap is checked from `Content-Length` before buffering, raster MIME types only
  (SVG rejected), 100k-character text cap, malformed JSON returns 400 instead of 500, and `/api/prescriptions/commit`
  sanitises every field it accepts.
- `scripts/security-test.mjs` runs **78 checks**: repository hygiene (no tracked env/db/photos/logs/keys/emails/
  phones/LAN addresses), auth gates, cookie flags, forged and tampered sessions, the closed elder PIN door,
  caregiver/elder separation, pairing-token single use, device revocation, upload limits, malformed input, security
  headers, no PIN hash or server secret in API responses or the client bundle, and the sign-in throttle (including
  `x-forwarded-for` rotation). **78/78 pass.**
- `npm audit --omit=dev` reports **0 vulnerabilities** after overriding the transitive `zod` to a patched 4.x.

**Docs and data**

- Replaced the realistic-looking sample with a clearly synthetic one (`Dr. A. Demo`, `Sample Patient`, `DEMO-0000`)
  and a footer saying it is not a real prescription. Deleted the old SVG source and the old `review-ocr.png`.
- Regenerated all `docs/` screenshots from the new sample and the confidence UI.
- Scrubbed repository/deployment identifiers, the LAN address, and stale test counts from the docs. The demo personas
  (Arjun and Lakshmi) are fictional and every seeded record is synthetic.

**Final results**

| Suite | Result |
|---|---|
| Unit (`npm test`) | **35/35** |
| Security and privacy (`npm run test:security`) | **78/78** |
| Mock OCR service (`npm run test:ocr-service`) | **14/14** |
| Browser E2E (`npm run test:ui`) | **13/13** |
| API smoke (`node scripts/smoke.mjs`) | **36/36** |
| Vision/OCR API (`node scripts/vision-test.mjs`) | **12/12** |
| `npx tsc --noEmit` / `npm run build` | clean |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

## Known issues and open questions

1. **Handwriting OCR is opt-in.** The Donut service has to be running and `OCR_SERVICE_URL`
   set; the hosted demo still uses the browser fallback and says so. The service has not been
   benchmarked on the four local prescription photos yet — that is the next honest measurement.
2. **Interaction severity is inferred, not licensed.** The free DrugBank extract has no
   severity, evidence or management column; flags say this and cite the DOI. The DrugBank
   clinical API would fix it but needs a commercial licence.
3. **First-token brand matching still loses spaced variants.** `Ecosprin-AV` is indexed, but a
   handwritten `Ecosprin AV` parses as `Ecosprin` because the OCR parser keeps one brand token.
   The raw line stays on the review screen, and every line needs confirmation.
4. **State is not in PostgreSQL** (JSON locally, Blob on Vercel).
5. **Prototype auth.** One demo caregiver PIN, shown on screen by design; no account recovery,
   no multi-user accounts. Do not use this build with real patient data.
6. **CSP still needs `'unsafe-inline'` for Next's bootstrap scripts** and allows the Tesseract
   worker from jsDelivr. There are no user-controlled HTML sinks; React escapes rendered text.
   A nonce-based CSP is a future hardening step.
7. **CSRF relies on SameSite=Lax** rather than a per-form token. State-changing APIs require
   JSON (except the image upload) and the cookie is host-only, but an explicit origin check
   would be belt-and-braces.
8. **Only sign-in is rate-limited.** Authenticated scan/commit calls are bounded by size caps
   and auth, not by a separate per-user quota.
9. **One elder and one caregiver** in the seeded data; multi-elder households are next.
10. Local LAN phone access needs an inbound firewall rule for TCP 3000 (needs elevation).
    The deployed URL is unaffected.
11. `POST /api/demo` with `{"action":"reset"}` restores the seeded week and clock, but it does
    **not** revoke paired phones. Remove them from the Paired devices card when starting clean.

---

## Agreed next steps (2026-10-29)

1. **Benchmark the Donut service** — run `services/ocr` over the four local prescription photos
   and record character/word accuracy. Confidence score is now shipped; this is the remaining
   measurement.
2. **RxNorm + openFDA** — normalise the 1,679 salts to standard identifiers and put label
   warnings behind the interaction flags; keep the DrugBank extract for pair coverage.
3. **PostgreSQL** for application state, if a database is provided.
4. **Logo** — the supplied lockup still needs placing (login, nav, favicon, social image).
5. **Pilot metric**: log caregiver corrections to OCR output so the deck's
   "OCR corrections made by caregivers" can actually be measured.
6. **Push notifications and a pharmacist queue** — the two product gaps the demo is honest about.

---

## How to run and re-test everything

```bash
npm install
npm run seed          # synthetic elder, caregiver and a week of history
npm run dev           # http://localhost:3000

npm test                      # 35 unit checks
npm run build                 # production build; generates .env.local locally
npm run test:security         # 78 repository + live security/privacy checks
npm run test:ocr-service      # 14 checks with a mock local OCR service
npm run test:ui               # 13 browser end-to-end checks

# These two need a server already running on http://localhost:3000:
node scripts/smoke.mjs        # 36 API assertions
node scripts/vision-test.mjs  # 12 vision/OCR API checks

npm run sample:make           # regenerate the synthetic sample prescription
npm run shots                 # regenerate docs/ screenshots (server on :3000)
node scripts/ocr-bench.mjs "folder-of-photos"   # OCR accuracy report over local photos

npm run data:fetch            # download the 45 MB source datasets (git-ignored)
npm run data:build            # regenerate lib/data/generated/ from them
```

`test:security`, `test:ocr-service`, and `test:ui` start their own production server and need
`npm run build` first. `npm audit --omit=dev` should report 0 vulnerabilities.

Demo: caregiver PIN `2468`. Elder screen: **Set up phone** on the dashboard, scan the QR
with a phone on the same Wi-Fi (or any phone on the hosted demo).
