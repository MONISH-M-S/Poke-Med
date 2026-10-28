# PokéMed

**A medication companion for elderly people and their families.**

> Love shouldn't depend on a phone call asking "did you take your medicine?"

Older adults forget doses or misread prescriptions, and family living far away has no way to know whether the
medicines were actually taken. PokéMed closes that loop: the caregiver scans the prescription, the elder gets one
enormous **Taken** button, and the family sees what happened — including the doses that were missed.

**Decision support, not medical advice.** PokéMed does not diagnose, prescribe, or replace a doctor or pharmacist.
Every extracted line needs a human confirmation before it is scheduled.

**Live demo:** <https://pokemed.vercel.app> — caregiver PIN `2468`; the elder's phone is added by scanning the QR code
from the dashboard. The hosted demo uses browser OCR unless a vision/OCR service is configured.

**Progress log:** [`docs/PROGRESS.md`](docs/PROGRESS.md) — the from-the-start record, test evidence, and open items.

---

## What it does

1. **Scan a prescription.** Photograph the page, drag a box around the medicine lines, and browser OCR reads just
   that box. A vision model is used instead when `OPENAI_API_KEY` is set, or a local Donut handwriting model when
   `OCR_SERVICE_URL` points at `services/ocr`. The doctor's shorthand is then decoded —
   `1-0-1`, `BD`, `TDS`, `HS`, `SOS`, `PC`, `AC`, `7 AM`, `8hrly`, `x 30 days`, `½`.
2. **The caregiver confirms.** Every extracted line is editable and shows a **read-confidence score**. Nothing is
   scheduled until a human says it is right. Hospital-only lines (IV/IM/injections) and supplies are reported
   separately and never put on a home schedule.
3. **A schedule is built.** Times are grouped into Morning / Afternoon / Night, with food instructions and course
   length. `SOS` medicines stay as-needed and never get a fixed slot.
4. **The elder gets one screen.** Huge text, a spoken reminder, and one big **Taken** button. Tamil and Hindi
   interfaces are included, with voice where the device has the voice installed.
5. **Every dose is logged** as taken or missed, with a timestamp and who confirmed it.
6. **Missed doses reach the caregiver.** After a 60-minute grace period the dose becomes missed and an alert appears
   on the caregiver dashboard.
7. **A weekly report** shows percent taken, a day-by-day grid, and every missed dose with its time.
8. **Conflicts are flagged for a pharmacist** — duplicate active ingredients across brand names, therapeutic
   duplication, a short curated list of risky pairs, and 58,522 DrugBank-derived salt pairs. Curated rules win;
   every flag names its source. Flags never tell anyone to stop a medicine.

---

## Screens

| Caregiver dashboard | Elder screen |
|---|---|
| ![Dashboard](docs/dashboard.png) | ![Elder screen](docs/elder-phone.png) |

| Caregiver sign-in | Confirming the prescription |
|---|---|
| ![Sign in](docs/login.png) | ![Review](docs/review.png) |

| Crop to the medicine lines |
|---|
| ![Upload](docs/upload.png) |

| Missed-dose alert |
|---|
| ![Missed dose](docs/dashboard-missed.png) |

The screenshots use the synthetic sample and the fictional demo personas. They contain no real patient data.

---

## Quick start

Requires **Node.js 20+**. No database server, API key, or model download is needed.

```bash
npm install
npm run seed     # a synthetic elder, caregiver and a realistic week of history
npm run dev      # http://localhost:3000
```

| Who | How | Sees |
|---|---|---|
| Arjun (caregiver) | PIN `2468` | Scan, schedule, report, flags, and the paired-phones card |
| Lakshmi (elder) | Scan the QR from **Set up phone** | Her own screen only: today's doses and the **Taken** button |

Arjun and Lakshmi are **fictional demo personas**. The seeded history is synthetic. The caregiver PIN is printed on
the sign-in screen on purpose; this is prototype auth, not a real account system.

For a fully offline demo: **New prescription → Use a sample → Read these lines**. For the photo path,
**Load sample photo → Read prescription** runs real OCR in the browser. Dragging a box around the medicine lines
before reading is the single biggest accuracy win on a phone photo.

The QR encodes this machine's LAN address, so the phone has to be on the same Wi-Fi network. If the link needs to be
something else — a tunnel, a fixed hostname — set `NEXT_PUBLIC_APP_URL` before starting the server.

---

## Privacy and security

- **Synthetic data only.** Do not enter real patient information. The demo names, prescriptions, and week of history
  are generated. No real prescription photos are in this repository.
- **No analytics or third-party trackers.**
- **Local by default.** State lives in `data/db.json` (git-ignored) or a **private** Vercel Blob store. Uploaded
  photos are read in memory and are not saved by the app.
- **Where a photo goes.** With no key, the photo stays in the browser (Tesseract.js). If `OPENAI_API_KEY` is set, the
  photo is sent to OpenAI. If `OCR_SERVICE_URL` is set, it is sent to that service first. Do not point this at real
  patient data.
- **Pairing QR is local.** The QR is generated on the server as a data URL; the single-use pairing token is never
  sent to a third-party QR image service.
- **Session security.** HMAC-signed, http-only, SameSite=Lax cookies; scrypt-hashed PIN; elder devices are separate,
  revocable, and cannot reach caregiver APIs. The API never returns the PIN hash.
- **Fail closed.** `AUTH_SECRET` is generated into `.env.local` for local runs and is **required in production**.
  There is no published fallback secret.
- **Security headers.** CSP, `X-Frame-Options: DENY`, `nosniff`, a restrictive `Referrer-Policy`, and a
  `Permissions-Policy` are set in `next.config.mjs`.
- **Upload limits.** Images are capped at 8 MB and restricted to raster types; text is capped at 100,000 characters;
  SVG and other non-image uploads are rejected.
- **Prototype limits.** One caregiver PIN, no account recovery, no email/push by default, and an in-memory sign-in
  throttle. Treat the public demo as a demo.

`npm run test:security` checks the repository for tracked secrets/databases/photos, then runs a live audit of auth
gates, cookie flags, forged sessions, elder/caregiver separation, pairing-token single use and revocation, upload
limits, malformed input, headers, secret leakage, and the sign-in throttle.

---

## The reader, honestly

The reader has two jobs, and only the second one is allowed to make decisions:

1. **Read** the page into text — a vision model or the local Donut service if configured, otherwise Tesseract.js in
   the browser.
2. **Decode** that text with deterministic rules, unit-tested in `npm test`.

A local benchmark (`scripts/ocr-bench.mjs`) runs the real upload screen over a folder of prescription photos kept
outside the repository. On this build, browser OCR alone did not recover a usable medicine line from the small,
partly handwritten phone photos in that local set. The photos are 387–1019 px, and Tesseract does not read cursive.
Cropping, upscaling, and a grayscale contrast stretch make the text visibly better (`scripts/ocr-lab.mjs`), but not
into a dose anyone should trust.

The handwriting path is built: **`services/ocr`** serves
[`chinmays18/medical-prescription-ocr`](https://huggingface.co/chinmays18/medical-prescription-ocr) — see
[`services/ocr/README.md`](services/ocr/README.md) for the exact model link — a Donut fine-tune (MIT, ~0.2B parameters,
reported 71% character / 84% word accuracy) over FastAPI. Start it, set `OCR_SERVICE_URL`, and `/api/scan` asks it
before OpenAI and Tesseract. It is deliberately not part of the Vercel bundle: a 0.2B-parameter PyTorch model does not
fit in a serverless function, so the hosted demo keeps the honest browser fallback.

The printed sample that ships with the demo parses **3 of 3** medicines; that is the honest boundary: clean print
works, handwriting needs a vision model or the Donut service. When OCR finds nothing, the app keeps the text on
screen, says why, and asks you to type the lines.

### Read-confidence score

Each review row shows a percentage. It is a **rule-based read confidence**, not an OCR probability:

- how clearly the dose pattern was written (`1-0-1`, `BD`, `HS`, `SOS`, …);
- whether the brand is in the Indian product index;
- whether timing had to be guessed.

A low score shows **“Not sure about this line? Ask your pharmacist before saving.”** The number is an honest reading
aid, not a medical judgement, and the human still confirms every line.

---

## How it works

```
Next.js (App Router) + TypeScript + Tailwind
├── app/            caregiver dashboard, scan, review, schedule, report, elder screen, flags
├── components/     elder dose card, status pills, demo panel
├── lib/
│   ├── parse/      doctor-shorthand decoder (deterministic rules)
│   ├── checks.ts   duplicate salt, therapeutic duplication, curated + DrugBank pairs
│   ├── state.ts    missed-dose sweep + sanitised dashboard view
│   ├── db.ts       file-backed store (data/db.json) or private Vercel Blob
│   ├── auth-*.ts   scrypt PIN hashing, HMAC sessions, secret handling
│   └── data/       generated 135k-brand index and 58k interaction pairs, plus curated overrides
├── services/ocr/   optional FastAPI + Donut handwriting reader
└── data/           seeded database; data/external/ holds the raw datasets (git-ignored)
```

**The model reads; the rules decide.** A vision model (or browser OCR) produces text. A deterministic parser turns
that text into times, and every rule has a unit test. No model is ever asked to invent a dose or a schedule — the
schedule is reproducible and explainable.

**One clock.** Every read of “now” goes through `lib/clock.ts`. The demo panel shifts it, and the missed-dose sweep
runs on each state read, so there is no cron job and nothing to wait for on stage.

**Two doors, one app.** `middleware.ts` checks a signed session on every page and API call. A paired phone can only
reach `/elder` and its three endpoints (`/api/state`, `/api/doses`, `/api/auth/me`); a caregiver session can reach
everything. The caregiver's whole login is a keypad — four digits, no keyboard. The elder never types anything: a
five-minute, single-use QR link pairs her phone, and Arjun can see every paired device and remove it.

**Safety checks compare active ingredients, not names.** `Crocin` and `Dolo` are both paracetamol, and that is
exactly the mistake families make. The brand→salt map comes from **253,973 real Indian product listings**
(135,121 brand tokens, 1,679 salts), with curated demo brands taking precedence. For combination families the plain
product decides the base composition — `Ecosprin` stays aspirin and does not inherit `Ecosprin AV`'s statin.
Interaction pairs come from a free **DrugBank 5.1 extract**; that dataset has no severity column, so severity is
inferred from the interaction wording and curated rules keep their stronger wording.

---

## Environment

Copy `.env.example` if you need to override anything. All values are optional locally.

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | Signs session cookies. **Required in production.** `npm run dev/build/start` generates one in `.env.local` locally. |
| `OPENAI_API_KEY` | Optional vision reader. Without it, browser OCR is used. |
| `OPENAI_VISION_MODEL` | Optional model override (default `gpt-4o-mini`). |
| `OCR_SERVICE_URL` | Optional local Donut service (`services/ocr`); tried before OpenAI. |
| `OCR_SHARED_SECRET` | Optional key for that service, sent as `x-ocr-key`. |
| `NEXT_PUBLIC_APP_URL` | Public origin used in the pairing QR (tunnel/hostname). |
| `POKEMED_TRUST_PROXY` | Set to `1` only behind a proxy that overwrites `x-forwarded-for`; otherwise the login throttle ignores it. |
| `BLOB_STORE_ID` / `BLOB_READ_WRITE_TOKEN` | Enables private Vercel Blob storage. |
| `RESEND_API_KEY` / `ALERT_FROM_EMAIL` | Optional email alerts (not wired by default). |

On Vercel: set `AUTH_SECRET` explicitly, connect a private Blob store, and set
`POKEMED_TRUST_PROXY=1` so the sign-in throttle sees the real client address.

---

## Testing

```bash
npm test                      # 35 unit checks: shorthand, parsing, confidence, drug data, safety rules
npm run build                 # production build (also generates .env.local locally)
npm run test:security         # 78 repository + live security/privacy checks
npm run test:ocr-service      # 14 checks with a mock local OCR service
npm run test:ui               # 13 browser end-to-end checks (Tesseract photo path included)
node scripts/smoke.mjs        # 36 API checks against a server on :3000
node scripts/vision-test.mjs  # 12 OCR API checks against a server on :3000
```

`test:security`, `test:ocr-service`, and `test:ui` start their own production server and require `npm run build`
first. `smoke.mjs` and `vision-test.mjs` expect a server already running on `http://localhost:3000`.

| Suite | Result |
|---|---|
| Unit (`npm test`) | **35/35** |
| Security and privacy (`npm run test:security`) | **78/78** |
| Mock OCR service (`npm run test:ocr-service`) | **14/14** |
| Browser E2E (`npm run test:ui`) | **13/13** |
| API smoke (`node scripts/smoke.mjs`) | **36/36** |
| Vision/OCR API (`node scripts/vision-test.mjs`) | **12/12** |
| `npx tsc --noEmit` / `npm run build` | clean |
| `npm audit --omit=dev` | **0 vulnerabilities** |

The security suite covers, among other things: signed-out gates, http-only/SameSite cookies, forged and tampered
sessions, the closed elder PIN door, caregiver/elder role separation, pairing-token single use, device revocation,
upload type/size validation, malformed JSON, response caching, CSP/security headers, no PIN hash or server secret in
API responses or the client bundle, and the sign-in throttle (including `x-forwarded-for` rotation).

---

## Data and provenance

- **Indian Medicine Dataset** (MIT): 253,973 products → 135,121 brand tokens, 1,679 salts. The CSV is malformed
  (unquoted commas inside composition cells), so `scripts/build-drug-index.mjs` splits the first seven columns and
  treats the rest as composition.
- **DrugBank 5.1 DDI extract** (CC BY 4.0, Yu 2020; Mendeley `md5czfsfnd`): 222,696 rows → 58,522 usable salt pairs.
  Low-signal interaction types are filtered; severity is inferred from wording, not licensed.
- Generated modules live in `lib/data/generated/` and are committed so deploys and `tsc` never need the 45 MB raw
  downloads. `npm run data:fetch` downloads them into `data/external/` (git-ignored); `npm run data:all` rebuilds.
- DrugBank's commercial API (licensed severity/evidence/management fields) is **not** used.

---

## What is real, and what is not

| Real | Mocked or limited |
|---|---|
| Shorthand decoding, schedule generation, dose logging | A single elder and caregiver in the seeded data |
| QR pairing, per-device list and removal | Prototype auth: one demo caregiver PIN, shown on screen; no account recovery |
| Missed-dose detection and alerts | Alert is on the caregiver dashboard; email/push not wired by default |
| Duplicate-salt and therapeutic-duplication checks | Interaction *severity* is inferred from type wording; the free extract has no licensed severity/management field |
| 253,973-product Indian brand index and 58,522 DrugBank-derived pairs | Curated demo brands and rules override the generated data where they overlap |
| Seven-day adherence maths | History is seeded so the report is meaningful in a demo |
| Printed-prescription OCR | Handwriting needs the optional Donut service; the hosted demo falls back to browser OCR |
| Tamil/Hindi interface strings | Voice depends on the device having that voice installed |

“Send to pharmacist” records a review request. No pharmacist is connected in this prototype.

---

## Demo in one minute

0. Sign in as Arjun with PIN `2468`. Open **Set up phone** and scan the QR with Lakshmi's phone.
1. Caregiver scans the sample prescription; the shorthand is decoded on screen; one field is corrected.
2. The schedule appears for today.
3. Demo → **Jump to the next dose**, then look at the paired phone. It speaks the dose; **Taken** is pressed.
4. The caregiver dashboard turns green in the same second.
5. Demo → **Skip to next missed dose** → the alert appears.
6. The report shows the week.
7. A flag opens: two medicines, same active ingredient, with the source named.

Closing line: **“They took care of us for a lifetime. Let's take care of their medicines.”**

---

## Next

- Push notifications and a real pharmacist review queue
- Licensed DrugBank fields (severity, evidence, management text)
- PostgreSQL for application state
- Multi-elder households and caregiver handover
- Offline-first elder app for low-connectivity homes
- Refill reminders and pharmacy integration
