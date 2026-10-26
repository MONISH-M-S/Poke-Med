# PokéMed — pitch and submission pack

**Decision support, not medical advice.** Say it on the flags slide and in the closing.

## One line

A medication companion for elderly people and their families.

## Opener

> "Love shouldn't depend on a phone call asking 'did you take your medicine?'"

## Problem

Older adults forget doses or misread prescriptions, and the family living far away has no way to know whether the
medicines were actually taken. The result is missed treatment and avoidable hospital visits.

## Solution

- The caregiver photographs the prescription. OCR extracts medicine names, dose and timing, and the caregiver fixes
  any mistakes before saving.
- Two separate doors: Arjun signs in with a PIN; Lakshmi's phone is paired once with a QR code, so she never types anything.
- PokéMed builds the schedule and prompts at dose time on the elder's screen.
- The elder's screen has huge text, a spoken reminder, and one big **Taken** button.
- Every dose is logged as taken or missed, with a timestamp.
- If a dose isn't confirmed within 60 minutes, the caregiver is alerted.
- The caregiver gets a seven-day adherence report: percent taken and the missed doses.
- Medicines that might conflict are flagged for a pharmacist, with the source shown.

## Why it stands out

Most teams stop at OCR or a reminder. PokéMed is built for elders first, and it closes the loop with the caregiver.
The two things judges remember:

1. **The loop.** Taken reaches the family in the same second; a missed dose reaches them without a phone call.
2. **The error guard.** Two different brand names containing the same active ingredient are flagged — the mistake
   families actually make — plus a short cited list of risky pairs, checked against medicines already on the list.

## Closing line

> "They took care of us for a lifetime. Let's take care of their medicines."

---

## Demo script (about 2:30)

| Time | On screen | Say |
|---|---|---|
| 0:00 | Medicine box photo | "Love shouldn't depend on a phone call asking 'did you take your medicine?'" |
| 0:05 | Sign-in screen, then **Set up phone** with a QR | "Arjun signs in with a PIN. His mother's phone is paired with one QR code — she never types anything." |
| 0:10 | Caregiver uploads the sample prescription | "Arjun lives in another city. His mother's prescription is a photo on his phone." |
| 0:20 | Decoder shows `1-0-1 PC` → morning + night, after food | "It reads the doctor's shorthand — `1-0-1` means morning and night — and builds a real schedule." |
| 0:35 | Caregiver fixes one field | "He corrects one line before saving. The human stays in the loop. This is decision support, not medical advice." |
| 0:45 | Elder screen, voice speaks, big Taken | "His mother gets one screen. Big text, spoken aloud, one button." |
| 0:55 | Taken → dashboard turns green live | "Arjun sees it turn green from another city." |
| 1:10 | Demo → Skip to next missed dose → red alert | "If a dose isn't confirmed in time, he knows — instead of finding out weeks later." |
| 1:30 | Report: 88%, missed list | "A week at a glance, and exactly which doses were missed." |
| 1:50 | Flag: duplicate paracetamol, source shown | "This is what a reminder app would never catch. Two medicines that both contain paracetamol. Flagged for a pharmacist, with the source. We never say 'don't take it.'" |
| 2:15 | Close | "They took care of us for a lifetime. Let's take care of their medicines." |

Rehearse to 2:15–2:40. Never let the live demo pass three minutes.

## Demo insurance

- The **Demo** button (bottom right) moves the clock, resets the seeded week, and returns to real time.
- If there is no OCR key, "Load sample photo" reads the printed sample in the browser, or "Use a sample" pastes the
  same text. Both paths end on the review screen.
- If the network is down, use "Use a sample" and the text path — no external service is involved.
- Reset the demo immediately before going on stage.

---

## Claims ledger

| Say | Phrase carefully | Never say |
|---|---|---|
| OCR extracts medicine, dose and timing | "best-effort on handwriting — that's why the caregiver confirms" | "reads any prescription" |
| Checks catch duplicate salts and curated risky pairs | "a short curated list with real citations" | "drug interaction database" |
| Caregiver gets alerted | "an alert on the caregiver dashboard" | "sends SMS/push" |
| Adherence report | "seven days of history in the prototype, seeded" | "tracks adherence over months" |
| Flags for pharmacist review | "a review request is created" | "a pharmacist reviews it" |
| Built for elders | "large type, one action, spoken prompts" | "clinically validated" |

---

## Deck (7 slides)

1. **Title** — PokéMed. "A medication companion for elderly people and their families." Opener line.
2. **Problem** — the gap between the prescription and the family. One story, one verified statistic.
3. **Who it's for** — Lakshmi, 72, and Arjun, her son in another city.
4. **What it does** — three screenshots: scan → elder screen → caregiver report.
5. **How it works** — the loop diagram. "The model reads; the rules decide." Deterministic schedule, tested checks.
6. **Why it's different, and what's honestly not done yet** — the loop, the error guard; no push notifications, no
   pharmacist connection, curated interaction list.
7. **Impact and next 90 days** — push + pharmacist queue + verified drug data + multi-elder households. Close on the
   pitch line. Disclaimer.

## Video storyboard (2 minutes)

| Time | Shot |
|---|---|
| 0:00–0:12 | Opener over a medicine box |
| 0:12–0:35 | Scan, shorthand decoded, one field fixed |
| 0:35–0:55 | Schedule appears, grouped morning/night |
| 0:55–1:20 | Elder screen speaks, Taken, dashboard turns green |
| 1:20–1:40 | Clock jump, missed alert |
| 1:40–2:00 | Report, flag with source, disclaimer, pitch line |

## Screenshots

Generated with `node scripts/shots.mjs` into `docs/`:

- `dashboard.png` — caregiver view, week, flags
- `login.png` — the caregiver sign-in
- `upload.png` — photo or typed prescription
- `review.png` — the confirmation screen
- `schedule.png` — the day, grouped
- `flag.png` — flagged for pharmacist review, with source
- `report.png` — seven-day adherence
- `elder.png` / `elder-phone.png` — the elder screen
- `dashboard-missed.png` — the missed-dose alert after the clock jump
