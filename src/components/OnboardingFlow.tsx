import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Bell, BellRing, BookOpenText, Check, ChevronLeft, Clock3, Compass, MoonStar, ShieldCheck, Sparkles } from 'lucide-react';
import { Madhab } from '../types';

type NotificationChoice = NotificationPermission | 'unsupported' | 'skipped';

interface OnboardingFlowProps {
  defaultMadhab: Madhab;
  onComplete: (madhab: Madhab, notificationChoice: NotificationChoice) => void;
}

const MADHABS: Array<{ id: Madhab; name: string; detail: string; asrMethod: string }> = [
  { id: 'hanafi', name: 'Hanafi', detail: 'Common across South and Central Asia', asrMethod: 'Later Asr' },
  { id: 'shafi', name: "Shafi'i", detail: 'Common across East Africa and Southeast Asia', asrMethod: 'Standard Asr' },
  { id: 'maliki', name: 'Maliki', detail: 'Common across North and West Africa', asrMethod: 'Standard Asr' },
  { id: 'hanbali', name: 'Hanbali', detail: 'Common across the Arabian Peninsula', asrMethod: 'Standard Asr' },
];

const STEPS = [
  { eyebrow: 'Your daily companion', title: 'Worship, made beautifully simple.', body: 'Keep your prayers, adhkaar, Quran reading, and daily remembrance close—wherever the day takes you.' },
  { eyebrow: 'Personalise prayer times', title: 'Choose your madhab.', body: 'This determines the Asr calculation used by prayer-time features. You can change it later.' },
  { eyebrow: 'Stay gently connected', title: 'Never miss a meaningful moment.', body: 'Enable thoughtful reminders for prayer, morning and evening adhkaar, and the routines that matter to you.' },
];

function WelcomeArt() {
  return (
    <div className="relative mx-auto h-64 w-full max-w-[320px]" aria-hidden="true">
      <motion.div animate={{ y: [0, -7, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} className="absolute inset-x-4 top-0 h-60 overflow-hidden rounded-[36px] border border-white/10 bg-gradient-to-br from-emerald-400/25 via-teal-400/10 to-indigo-400/15 shadow-2xl shadow-black/30">
        <MoonStar className="absolute right-7 top-7 h-14 w-14 text-amber-300 drop-shadow-[0_0_18px_rgba(252,211,77,0.35)]" strokeWidth={1.4} />
        <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-emerald-950 to-transparent" />
        <svg viewBox="0 0 320 150" className="absolute bottom-0 w-full text-emerald-950" fill="currentColor">
          <path d="M0 150V105h31V89h13v16h25V72h9V48h7V33h7v15h7v24h9v33h24V89h13v16h24V76h7V55h8V41h8v14h8v21h7v29h27V92h13v13h31v45H0Z" />
          <path d="M119 107V83c0-22 18-40 41-40s41 18 41 40v24h-13V84c0-16-12-28-28-28s-28 12-28 28v23h-13Z" />
        </svg>
        <div className="absolute bottom-7 left-1/2 flex h-24 w-32 -translate-x-1/2 items-center justify-center rounded-t-[64px] border border-amber-300/20 bg-emerald-900"><BookOpenText className="h-14 w-14 text-amber-300" strokeWidth={1.25} /></div>
      </motion.div>
      <motion.div animate={{ rotate: [0, 5, 0] }} transition={{ duration: 6, repeat: Infinity }} className="absolute bottom-0 left-1 flex h-15 w-15 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-500/20 shadow-xl backdrop-blur-xl"><Compass className="h-7 w-7 text-emerald-200" /></motion.div>
      <motion.div animate={{ rotate: [0, -4, 0] }} transition={{ duration: 5.5, repeat: Infinity }} className="absolute bottom-2 right-0 flex h-15 w-15 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-400/15 shadow-xl backdrop-blur-xl"><Clock3 className="h-7 w-7 text-amber-200" /></motion.div>
    </div>
  );
}

function NotificationArt() {
  return (
    <div className="relative mx-auto flex h-60 w-full items-center justify-center" aria-hidden="true">
      <div className="absolute h-52 w-52 rounded-full bg-emerald-400/10 blur-2xl" />
      <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity }} className="relative flex h-42 w-42 items-center justify-center rounded-[44px] border border-white/10 bg-gradient-to-br from-emerald-400/25 to-teal-500/5 shadow-2xl">
        <BellRing className="h-19 w-19 text-amber-300" strokeWidth={1.3} />
        {[0, 1, 2].map((i) => <motion.span key={i} animate={{ scale: [0.8, 1.4], opacity: [0.6, 0] }} transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.7 }} className="absolute inset-3 rounded-[38px] border border-emerald-300/25" />)}
      </motion.div>
      <div className="absolute bottom-2 left-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/75 px-3 py-2 shadow-xl backdrop-blur-lg"><ShieldCheck className="h-4 w-4 text-emerald-300" /><span className="text-[10px] font-bold text-slate-200">Private & in your control</span></div>
    </div>
  );
}

export default function OnboardingFlow({ defaultMadhab, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [madhab, setMadhab] = useState<Madhab>(defaultMadhab);
  const [requesting, setRequesting] = useState(false);
  const copy = STEPS[step];

  const enableNotifications = async () => {
    if (!('Notification' in window)) return onComplete(madhab, 'unsupported');
    if (Notification.permission !== 'default') return onComplete(madhab, Notification.permission);
    setRequesting(true);
    try { onComplete(madhab, await Notification.requestPermission()); }
    catch { onComplete(madhab, 'skipped'); }
    finally { setRequesting(false); }
  };

  return (
    <div className="min-h-screen w-screen overflow-y-auto bg-slate-100 md:flex md:items-center md:justify-center md:px-4 md:py-10">
      <div className="relative flex min-h-[100dvh] w-full max-w-sm flex-col overflow-hidden bg-[#071a18] text-white md:h-[780px] md:min-h-0 md:rounded-[40px] md:border-[12px] md:border-neutral-900 md:shadow-2xl">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
        <header className="relative z-10 flex items-center justify-between px-6 pb-2 pt-[max(1.5rem,env(safe-area-inset-top))]">
          {step > 0 ? <button onClick={() => setStep(step - 1)} aria-label="Go back" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 focus-visible:ring-2 focus-visible:ring-emerald-300"><ChevronLeft className="h-5 w-5" /></button> : <div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400 text-emerald-950"><MoonStar className="h-5 w-5" /></div><span className="font-display text-sm font-bold">Dhikr</span></div>}
          {step === 0 && <button onClick={() => onComplete(defaultMadhab, 'skipped')} className="rounded-full px-3 py-2 text-xs font-bold text-slate-400 hover:text-white">Skip</button>}
        </header>

        <main className="relative z-10 flex min-h-0 flex-1 flex-col px-6">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.28 }} className="flex min-h-0 flex-1 flex-col">
              <div className="flex flex-1 items-center">
                {step === 0 && <WelcomeArt />}
                {step === 1 && <div className="w-full space-y-2.5 py-3">{MADHABS.map((item, index) => {
                  const selected = item.id === madhab;
                  return <motion.button key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.045 }} onClick={() => setMadhab(item.id)} aria-pressed={selected} className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left focus-visible:ring-2 focus-visible:ring-emerald-300 ${selected ? 'border-emerald-300/55 bg-emerald-400/15' : 'border-white/8 bg-white/[0.035]'}`}><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-emerald-300 text-emerald-950' : 'bg-white/5 text-slate-400'}`}>{selected ? <Check className="h-5 w-5" strokeWidth={3} /> : <BookOpenText className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="text-sm font-extrabold">{item.name}</p><span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase ${selected ? 'bg-emerald-300/15 text-emerald-200' : 'bg-white/5 text-slate-500'}`}>{item.asrMethod}</span></div><p className="mt-0.5 text-[9px] text-slate-400">{item.detail}</p></div></motion.button>;
                })}</div>}
                {step === 2 && <NotificationArt />}
              </div>

              <div className="pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                <div className="mb-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.19em] text-emerald-300"><Sparkles className="h-3 w-3" />{copy.eyebrow}</div>
                <h1 className="font-display text-[30px] font-bold leading-[1.08] tracking-[-0.035em]">{copy.title}</h1>
                <p className="mt-3 text-[13px] leading-6 text-slate-400">{copy.body}</p>
                {step === 2 && <div className="mt-4 grid grid-cols-2 gap-2"><div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.035] p-2.5"><Clock3 className="h-4 w-4 text-emerald-300" /><span className="text-[9px] font-bold text-slate-300">Prayer reminders</span></div><div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.035] p-2.5"><MoonStar className="h-4 w-4 text-emerald-300" /><span className="text-[9px] font-bold text-slate-300">Daily adhkaar</span></div></div>}
                <div className="mt-6 flex gap-2">{STEPS.map((_, i) => <motion.span key={i} animate={{ width: i === step ? 24 : 6, opacity: i === step ? 1 : 0.35 }} className="h-1.5 rounded-full bg-emerald-300" />)}</div>
                <div className="mt-5 space-y-2">
                  {step < 2 ? <motion.button whileTap={{ scale: 0.98 }} onClick={() => setStep(step + 1)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-300 py-3.5 text-sm font-black text-emerald-950 shadow-xl"><span>Continue</span><ArrowRight className="h-4 w-4" /></motion.button> : <><motion.button whileTap={{ scale: 0.98 }} onClick={enableNotifications} disabled={requesting} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-300 py-3.5 text-sm font-black text-emerald-950 shadow-xl disabled:opacity-70"><Bell className="h-4 w-4" />{requesting ? 'Waiting for permission…' : 'Enable notifications'}</motion.button><button onClick={() => onComplete(madhab, 'skipped')} className="w-full py-2 text-xs font-bold text-slate-400 hover:text-white">Not now</button></>}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
