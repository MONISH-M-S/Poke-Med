# Project progress log

A from-the-start record of what PokéMed is, what was built, what was tested, and what is
still open. Written 2026-10-27.

| | |
|---|---|
| Repository | https://github.com/MONISH-M-S/Poke-Med |
| Live demo | https://pokemed.vercel.app |
| Pitch deck | `Poke-Med-Dexathon-2026.pdf` (Team ID `DEX26286`, theme Healthcare, PS category Software) |
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
| Confidence score per medicine, "not sure, ask your pharmacist" | **Open** — the deck itself marks it `[Review built; score planned]` |
| Reads a handwritten Rx photo | **Conditional** — true only with a vision-model key; today it falls back to browser OCR |
| Drug data: RxNorm + openFDA | **Open** — deck says `Next:`; today there is a hand-built 60-brand map and 12 curated interaction pairs |
| Indian brand → generic map (Dolo = paracetamol) | Built (demo map), to be expanded with a licensed Indian database |
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
| Project | `pokemed` under scope `promptwars12`, linked to the GitHub repo (pushes to `main` auto-deploy) |
| Storage | private Blob store `pokemed-data`, connected via OIDC (`BLOB_STORE_ID`, `BLOB_WEBHOOK_PUBLIC_KEY`) |
| Secrets | `AUTH_SECRET` (production + preview, marked secret), `POKEMED_TRUST_PROXY=1` so login throttling uses the real client IP |
| Verified live | login → state → create pairing link → redeem → device list → elder state → nudge → revoke → revoked device `401`; browser login keypad, dashboard, **zero console errors** |

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

Paired a phone through the real QR link (`http://10.226.51.99:3000/api/pair/…` → `/elder`),
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
- `npm run test` → **22/22**
- `npx tsc --noEmit` → clean; `npm run build` → clean

---

## Known issues and open questions

1. **No vision key configured.** The vision route returns `needs-text` and the browser reads
   the photo. That works for printed text (verified above) and **fails on the three
   handwritten photos** in `priscrip'`. The deck's "reads handwritten Rx: Yes" needs a key.
2. **One photo went missing on the review screen.** The first end-to-end run stored
   `image: null` even though the preview was on screen; two later runs — including a
   deliberate back-to-back "Load sample" + "Read prescription" click — stored the image
   correctly. Not reproduced; worth watching.
3. **No confidence score yet** — the biggest gap between the deck and the product.
4. **Drug data is hand-built**: 60 brands, 12 interaction pairs. RxNorm and openFDA are
   planned in the deck and need no API key.
5. **State is not in PostgreSQL** (JSON locally, Blob on Vercel).
6. `npm audit` reports 3 moderate Tailwind build-time advisories.
7. Local LAN phone access needs an inbound firewall rule for TCP 3000 (needs elevation).
   The deployed URL is unaffected.
8. Two paired devices are currently listed on the local demo; `POST /api/demo`
   with `{"action":"reset"}` restores the seeded week (works on Vercel too).

---

## Agreed next steps (2026-10-28)

1. **Vision model + confidence score** — free-tier key (Gemini Flash was the recommendation),
   per-medicine confidence with the deck's "not sure, ask your pharmacist" wording.
2. **RxNorm + openFDA** — normalise brand/ingredient names for clash checks, put label
   warnings behind the interaction flags, expand the brand map.
3. **PostgreSQL** for application state, if a database is provided.
4. **Logo** — the supplied lockup still needs placing (login, nav, favicon, social image).
5. **Pilot metric**: log caregiver corrections to OCR output so the deck's
   "OCR corrections made by caregivers" can actually be measured.

---

## How to run and re-test everything

```bash
npm install
npm run seed          # synthetic elder, caregiver and a week of history
npm run dev           # http://localhost:3000

node scripts/smoke.mjs        # 36 end-to-end assertions
npm run test                  # 22 unit checks
node scripts/vision-test.mjs  # 12 vision/OCR API checks (server must be running)
node scripts/ocr-bench.mjs "folder-of-photos"   # OCR accuracy report over real photos
```

Demo: caregiver PIN `2468`. Elder screen: **Set up phone** on the dashboard, scan the QR
with a phone on the same Wi-Fi (or any phone on the hosted demo).
