"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { postJSON, useAppState, optimisticUpdate } from "@/lib/client";
import { ElderSkeleton } from "@/components/Skeleton";
import { useSuccessToast, useErrorToast } from "@/components/Toast";
import type { AppState, DoseView } from "@/lib/types";

type Lang = "en" | "ta" | "hi";

const T = {
  en: {
    timeFor: "Time for your medicine",
    nextUp: "Your next medicine",
    taken: "Taken",
    remind: "Remind me in 10 min",
    again: "Say again",
    allDone: "All done for today",
    next: "Next dose",
    missedQ: "Did you take this one?",
    missed: "Missed",
    due: "Due now",
    upcoming: "Next dose",
    help: "Need help? Call",
    wellDone: "Well done",
    voice: "Voice",
    language: "Language",
    notConfirmed: "Not confirmed yet",
    takeIt: "Press this after you take it",
    nudgeFrom: "sent you a reminder",
  },
  ta: {
    timeFor: "உங்கள் மருந்து நேரம்",
    nextUp: "உங்கள் அடுத்த மருந்து",
    taken: "எடுத்துக்கொண்டேன்",
    remind: "10 நிமிடம் கழித்து நினைவூட்டு",
    again: "மீண்டும் சொல்",
    allDone: "இன்றைக்கு முடிந்தது",
    next: "அடுத்த மருந்து",
    missedQ: "இதை எடுத்துக்கொண்டீர்களா?",
    missed: "தவறவிட்டது",
    due: "இப்போது",
    upcoming: "அடுத்த மருந்து",
    help: "உதவி வேண்டுமா? அழை",
    wellDone: "நன்றி",
    voice: "குரல்",
    language: "மொழி",
    notConfirmed: "இன்னும் உறுதி செய்யவில்லை",
    takeIt: "எடுத்த பிறகு இதை அழுத்துங்கள்",
    nudgeFrom: "உங்களுக்கு நினைவூட்டல் அனுப்பியுள்ளார்",
  },
  hi: {
    timeFor: "आपकी दवा का समय",
    nextUp: "आपकी अगली दवा",
    taken: "ले लिया",
    remind: "10 मिनट बाद याद दिलाएँ",
    again: "फिर से सुनाएँ",
    allDone: "आज के लिए पूरा",
    next: "अगली दवा",
    missedQ: "क्या आपने यह ली?",
    missed: "छूट गई",
    due: "अभी",
    upcoming: "अगली दवा",
    help: "मदद चाहिए? कॉल करें",
    wellDone: "बहुत अच्छा",
    voice: "आवाज़",
    language: "भाषा",
    notConfirmed: "अभी पुष्टि नहीं हुई",
    takeIt: "दवा लेने के बाद इसे दबाएँ",
    nudgeFrom: "ने आपको याद दिलाया",
  },
} as const;

function foodWord(lang: Lang, rel: DoseView["relationToFood"]) {
  if (!rel) return "";
  if (lang === "ta") return rel === "after" ? "உணவுக்குப் பிறகு" : rel === "before" ? "உணவுக்கு முன்" : "உணவுடன்";
  if (lang === "hi") return rel === "after" ? "खाने के बाद" : rel === "before" ? "खाने से पहले" : "खाने के साथ";
  return rel === "after" ? "after food" : rel === "before" ? "before food" : "with food";
}

export default function ElderScreen() {
  const { state, setState, error } = useAppState(5000);
  const [lang, setLang] = useState<Lang>("en");
  const [voiceOn, setVoiceOn] = useState(true);
  const [justTaken, setJustTaken] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastSpoken = useRef<string | null>(null);
  const successToast = useSuccessToast();
  const errorToast = useErrorToast();

  const t = T[lang];

  const dose = useMemo(() => {
    if (!state) return null;
    return state.today.filter((d) => d.status !== "taken").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0] ?? null;
  }, [state]);

  const speak = useCallback(
    (target: DoseView, language: Lang) => {
      if (!voiceOn || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const synth = window.speechSynthesis;
      synth.cancel();

      const food = foodWord(language, target.relationToFood);
      let text = `${T[language].timeFor}. ${target.brand}. ${target.strength ?? ""}. ${target.doseLabel}. ${food}.`;
      let utterLang = language === "ta" ? "ta-IN" : language === "hi" ? "hi-IN" : "en-IN";

      const voices = synth.getVoices();
      const hasVoice = voices.some((v) => v.lang?.toLowerCase().startsWith(language === "en" ? "en" : language));
      if (!hasVoice && language !== "en") {
        setVoiceNote("This device has no Tamil/Hindi voice installed — reading in English.");
        utterLang = "en-IN";
        text = `${T.en.timeFor}. ${target.brand}. ${target.strength ?? ""}. ${target.doseLabel}. ${foodWord("en", target.relationToFood)}.`;
      } else {
        setVoiceNote(null);
      }

      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = utterLang;
      utter.rate = 0.82;
      const preferred = voices.find((v) => v.lang?.toLowerCase() === utterLang.toLowerCase());
      if (preferred) utter.voice = preferred;
      synth.speak(utter);
    },
    [voiceOn],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => window.speechSynthesis.getVoices();
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", load);
  }, []);

  useEffect(() => {
    if (!dose || !voiceOn) return;
    const key = `${dose.id}:${lang}`;
    if (lastSpoken.current === key) return;
    lastSpoken.current = key;
    const timer = setTimeout(() => speak(dose, lang), 500);
    return () => clearTimeout(timer);
  }, [dose, lang, voiceOn, speak]);

  async function take() {
    if (!dose || busy) return;
    setBusy(true);
    try {
      const previous = optimisticUpdate(setState, dose.id, "taken");
      const next = await postJSON<AppState>("/api/doses", { doseId: dose.id, action: "taken", actor: "elder" });
      setState(next);
      setJustTaken(true);
      successToast(t.taken, `${dose.brand} ${dose.strength}`);
      if (voiceOn && "speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(t.wellDone);
        u.lang = lang === "ta" ? "ta-IN" : lang === "hi" ? "hi-IN" : "en-IN";
        u.rate = 0.85;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }
      setTimeout(() => setJustTaken(false), 2600);
    } catch (e) {
      errorToast("Could not mark dose", e instanceof Error ? e.message : "Please try again");
    } finally {
      setBusy(false);
    }
  }

  async function snooze() {
    if (!dose || busy) return;
    setBusy(true);
    try {
      const previous = optimisticUpdate(setState, dose.id, "snooze");
      const next = await postJSON<AppState>("/api/doses", { doseId: dose.id, action: "snooze" });
      setState(next);
      successToast("Reminder snoozed", "Will remind again in 10 minutes");
    } catch (e) {
      errorToast("Could not snooze", e instanceof Error ? e.message : "Please try again");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login?switch=1";
  }

  if (error) {
    return (
      <div className="elder-body grid min-h-screen place-items-center p-6">
        <div className="text-center">
          <p className="text-2xl font-bold">Could not load</p>
          <button className="btn-primary mt-4" onClick={() => location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!state) {
    return <ElderSkeleton />;
  }

  const nextDose = state.nextDose;
  const isUpcoming = dose ? new Date(dose.scheduledAt).getTime() > new Date(state.now).getTime() : false;
  const nextTime = nextDose
    ? new Date(nextDose.scheduledAt).toLocaleString("en-IN", {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="elder-body min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 pb-8 pt-5">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-lg font-extrabold tracking-tight text-brand-700">
            PokéMed
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <div className="flex rounded-full border border-line bg-white p-1" role="group" aria-label={t.language}>
              {(["en", "ta", "hi"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`rounded-full px-2 py-1 text-xs font-bold ${
                    lang === l ? "bg-brand-600 text-white" : "text-muted"
                  }`}
                  aria-pressed={lang === l}
                >
                  {l === "en" ? "EN" : l === "ta" ? "த" : "हि"}
                </button>
              ))}
            </div>
            <button
              onClick={() => setVoiceOn((v) => !v)}
              className={`rounded-full border px-2.5 py-1.5 text-xs font-bold ${
                voiceOn ? "border-brand-100 bg-brand-50 text-brand-700" : "border-line bg-white text-muted"
              }`}
              aria-pressed={voiceOn}
            >
              {t.voice} {voiceOn ? "on" : "off"}
            </button>
            <button
              onClick={() => void signOut()}
              className="rounded-full border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-muted"
            >
              Switch
            </button>
          </div>
        </div>

        {state.nudge && (
          <div className="mt-5 rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-4">
            <p className="text-xl font-extrabold text-amber-900">
              {state.nudge.from} {t.nudgeFrom}
            </p>
          </div>
        )}

        <div className="mt-6 flex items-baseline justify-between">
          <p className="text-xl font-semibold text-muted">{state.elder.name}</p>
          <p className="text-xl font-semibold tabular-nums text-muted">
            {new Date(state.now).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
          </p>
        </div>

        {justTaken && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-brand-50 px-5 py-4 text-xl font-bold text-brand-700">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            {t.wellDone}
          </div>
        )}

        {dose ? (
          <div className="mt-4 flex flex-1 flex-col">
            <div
              className={`card flex flex-1 flex-col justify-center p-6 sm:p-8 ${
                dose.status === "missed" ? "border-red-200" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`pill text-sm ${
                    dose.status === "missed"
                      ? "bg-red-50 text-alert"
                      : isUpcoming
                      ? "bg-brand-50 text-brand-700"
                      : "bg-amber-50 text-warn"
                  }`}
                >
                  {dose.status === "missed" ? t.missed : isUpcoming ? t.upcoming : t.due}
                </span>
                <span className="text-xl font-bold tabular-nums text-muted">{dose.time}</span>
              </div>

              <p className="mt-6 text-xl font-semibold text-brand-700">{isUpcoming ? t.nextUp : t.timeFor}</p>
              <h1 className="elder-name mt-2 font-extrabold text-ink">{dose.brand}</h1>
              {dose.strength && <p className="mt-2 text-2xl font-semibold text-muted">{dose.strength}</p>}

              <p className="elder-dose mt-4 font-bold text-ink">
                {dose.doseLabel}
                {dose.relationToFood && (
                  <span className="block text-xl font-semibold text-muted">
                    {foodWord(lang, dose.relationToFood)}
                  </span>
                )}
              </p>

              {dose.status === "missed" && (
                <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-lg font-semibold text-alert">{t.missedQ}</p>
              )}

              <button className="elder-taken mt-8" onClick={take} disabled={busy}>
                {t.taken}
              </button>
              <p className="mt-3 text-center text-base text-muted">{t.takeIt}</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button className="btn-ghost min-h-[58px] text-base font-bold" onClick={snooze} disabled={busy}>
                  {t.remind}
                </button>
                <button
                  className="btn-ghost min-h-[58px] text-base font-bold"
                  onClick={() => {
                    lastSpoken.current = null;
                    speak(dose, lang);
                  }}
                >
                  {t.again}
                </button>
              </div>
            </div>

            {voiceNote && <p className="mt-3 text-center text-xs text-muted">{voiceNote}</p>}

            <p className="mt-6 text-center text-sm text-muted">
              {t.help}{" "}
              <a className="font-semibold text-brand-700 underline" href="tel:+910000000000">
                {state.caregiver.name}
              </a>
            </p>
          </div>
        ) : (
          <div className="mt-4 flex flex-1 flex-col">
            <div className="card flex flex-1 flex-col items-center justify-center p-8 text-center">
              <span className="grid h-24 w-24 place-items-center rounded-full bg-brand-50 text-brand-600">
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <h1 className="elder-name mt-6 font-extrabold text-ink">{t.allDone}</h1>
              {nextDose && nextTime ? (
                <p className="mt-4 text-xl font-semibold text-muted">
                  {t.next}: {nextTime}
                  <span className="block text-ink">{nextDose.brand}</span>
                </p>
              ) : (
                <p className="mt-4 text-xl text-muted">{t.next}: —</p>
              )}
            </div>

            <p className="mt-6 text-center text-sm text-muted">
              {t.help}{" "}
              <a className="font-semibold text-brand-700 underline" href="tel:+910000000000">
                {state.caregiver.name}
              </a>
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pb-2">
          <p className="text-center text-[11px] leading-snug text-muted">Decision support, not medical advice.</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-[11px] font-semibold text-muted underline decoration-dotted underline-offset-2 hover:text-ink"
          >
            Switch person
          </button>
        </div>
      </div>
    </div>
  );
}