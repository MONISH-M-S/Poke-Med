# Submission pack

Ready-to-paste text for a hackathon or college submission form. Every claim here is true of the current build; the
honest limitations are included on purpose, because judges reward them.

Replace anything in `[brackets]` before submitting.

---

## Basics

**Project name:** PokéMed

**Tagline (under 60 characters):**
> One big Taken button — and the family finally knows.

**One-liner:**
> A medication companion for elderly people and their families: the caregiver scans the prescription, the elder gets
> one enormous **Taken** button, and missed doses reach the family without a phone call.

**Elevator pitch (50 words):**
> Older adults forget doses or misread prescriptions, and children living in another city have no way to know what
> happened. PokéMed turns a prescription photo into a confirmed schedule, gives the elder one screen with a single
> Taken button, and shows the caregiver every dose taken or missed.

**Links**

| Field | Value |
|---|---|
| Repository | https://github.com/MONISH-M-S/Poke-Med |
| Live demo | https://pokemed.vercel.app |
| Demo video | [YouTube/Drive link] |
| Team | [names, roles] |

**Demo credentials**

- Caregiver sign-in: PIN `2468` (printed on the sign-in screen by design).
- Elder: no PIN. On the dashboard press **Set up phone** and scan the QR with any phone — on the hosted demo it works
  over mobile data; when running locally the phone must be on the same Wi-Fi.

---

## Problem

Older adults take several medicines a day, often on a schedule written in a shorthand only a pharmacist reads:
`1-0-1 PC`, `BD`, `SOS`, `x 30 days`. They forget doses, take the wrong one, or stop early. Their children live in
another city and cannot ask "did you take your medicine?" without sounding like a monitor.

The result is missed treatment and avoidable hospital visits — and families who only find out weeks later.

## Solution

PokéMed closes that loop in four steps:

1. **Read** — the caregiver photographs the prescription; OCR extracts the medicine lines.
2. **Confirm** — a deterministic decoder turns `1-0-1 PC` into morning and night, after food. Every line is editable
   and nothing is scheduled until a human confirms it.
3. **Act** — the elder's phone is paired by scanning a QR code (never a PIN). Their screen has large type, a spoken
   reminder, and one **Taken** button.
4. **Close the loop** — every dose is logged. A dose not confirmed within 60 minutes becomes *missed*, and an alert
   appears on the caregiver's dashboard, with a seven-day adherence report.

Separately, the app flags possible medication conflicts for a pharmacist — two brands with the same active ingredient
(Crocin and Dolo are both paracetamol), therapeutic duplication, and a short cited list of risky pairs.

## How it works

- **Next.js 15 (App Router) + TypeScript + Tailwind**, no database server: an atomic JSON file store, which keeps the
  demo one command to run.
- **The model reads; the rules decide.** AI or browser OCR produces text; a deterministic, unit-tested parser produces
  the schedule. No model is ever asked to invent a dose.
- **Auth designed for the actual users.** The caregiver types a four-digit PIN. The elder types nothing: a single-use,
  five-minute QR link issues a 180-day cookie tied to a device id that the caregiver can revoke from the dashboard.
- **One clock.** Every "now" goes through one module, so the demo panel can jump to the next dose or the next missed
  dose on stage — no waiting for a cron job.
- **Honest OCR.** Clean print parses 3 of 3 sample lines. Handwriting is best-effort, and the app says so instead of
  guessing. A local benchmark on four real photos is included in the repo.

## Built with

`Next.js` · `TypeScript` · `Tailwind CSS` · `Node.js` · `Web Crypto (HMAC)` · `scrypt` · `Tesseract.js` ·
`OpenAI vision (optional)` · `Playwright` (screenshots and smoke tests)

## What makes it different

1. **The loop, not just a reminder.** Taken reaches the family in the same second; a missed dose reaches them without
   a phone call.
2. **It is built for the elder, not for the person buying it.** One action, huge type, voice, Tamil and Hindi, and no
   login to remember.
3. **The error guard.** Duplicate active ingredients across brand names are caught — the mistake families actually
   make — with a named source for every flag.

## Challenges

- Making the QR reachable from a phone: a code containing `localhost` sends the phone to itself. The server now
  substitutes its LAN address, with an environment override for tunnels.
- Keeping paired devices truthful: the list has to survive restarts, reflect a pairing made on another phone within
  seconds, and forget a device the moment it is removed.
- Reading messy prescriptions without pretending to be right: the parser is deterministic and tested, and the UI asks
  for confirmation instead of hiding uncertainty.

## What we are proud of

- 36 end-to-end smoke checks (including "a removed device loses access") and 22 unit checks on the parser and safety
  rules, all green.
- A full security pass: no shipped signing secret (one is generated per machine), CSP, httpOnly cookies, per-device
  revocation, and no elder PIN door to attack.
- The demo runs offline: sample prescription, seeded week, no external service required.

## Honest limitations

- Prototype auth: one demo caregiver PIN, no account recovery.
- One elder and one caregiver in the seeded data; multi-elder households are next.
- The interaction list is short and curated, not a drug database. Flags are for a pharmacist; the app never says
  "don't take it".
- Handwriting OCR needs a vision model. Printed text works today.
- Alerts appear on the dashboard; email/push is not wired by default.
- All data is synthetic. Do not enter real patient information.

## What's next

Push notifications and a pharmacist review queue · a verified drug database and interaction service · multi-elder
households and caregiver handover · an offline-first elder app · refill reminders and pharmacy integration.

---

## 3-minute judge walkthrough

| Time | Do this | Say this |
|---|---|---|
| 0:00 | Sign-in screen | "Arjun lives in another city. His mother's prescription is a photo on his phone." |
| 0:10 | **Set up phone**, scan the QR with a real phone | "She never types a PIN. One scan, and her phone is hers." |
| 0:25 | New prescription → **Load sample photo** → **Read prescription** | "It reads the doctor's shorthand: 1-0-1 means morning and night, after food." |
| 0:45 | Correct one field → save | "He confirms one line. The human stays in the loop — this is decision support, not medical advice." |
| 1:00 | Demo → **Jump to the next dose**, look at the paired phone | "One screen. Big text, spoken aloud, one button." |
| 1:10 | Press **Taken** on the phone | "The dashboard turns green in the same second." |
| 1:25 | Demo → **Skip to next missed dose** | "Unconfirmed for an hour, and he knows — instead of finding out weeks later." |
| 1:40 | Report | "A week at a glance, and exactly which doses were missed." |
| 1:55 | Flag with source | "Two brands, same paracetamol. A reminder app would never catch this." |
| 2:20 | Dashboard → **Paired devices** → **Remove** | "If the phone is lost, he removes it — and it stops working immediately." |
| 2:30 | Close | "They took care of us for a lifetime. Let's take care of their medicines." |

## Before you hit submit

- [ ] Repository is public and the latest commit is pushed.
- [ ] A fresh clone runs: `npm install`, `npm run seed`, `npm run dev` (no keys required).
- [ ] Demo video is under the event's limit, has audio, and shows the paired phone and the Taken → dashboard update.
- [ ] Every screenshot in the submission matches the current build.
- [ ] The demo link (if any) works from a phone on mobile data, not just your Wi-Fi.
- [ ] Credentials are stated in the submission text, not only in the video.
- [ ] No real patient data, keys, or `.env.local` in the repo or video.
