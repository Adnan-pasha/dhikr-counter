import React from 'react';
import { BellRing, BellOff, ChevronDown } from 'lucide-react';
import type { NativeAlarms } from '../../useNativeAlarms';

interface NativeAlarmsCardProps {
  alarms: NativeAlarms;
  /** The clock, replaceable so tests can set the time. */
  now?: () => Date;
}

const realClock = (): Date => new Date();

const sameDay = (a: Date, b: Date): boolean => a.toDateString() === b.toDateString();

/** "today", "tomorrow", or the weekday, in the phone's own calendar. */
const dayWord = (at: Date, now: Date): string => {
  if (sameDay(at, now)) return 'today';
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (sameDay(at, tomorrow)) return 'tomorrow';
  return at.toLocaleDateString('en-US', { weekday: 'long' });
};

const clock = (at: Date): string => at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const surface = { background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)' } as const;
const action = 'min-h-11 w-full rounded-xl px-4 text-sm font-black cursor-pointer text-on-brand';

/**
 * Whether the call to prayer and the reminders can ring with the app closed, in plain words: what is missing,
 * a button that fixes it, the next alert, and a test that rings in ten seconds. Shown only inside the Android app.
 */
export default function NativeAlarmsCard({ alarms, now = realClock }: NativeAlarmsCardProps) {
  const [testMessage, setTestMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  if (!alarms.supported || !alarms.status) return null;
  const { notifications, exactAlarms } = alarms.status;
  const failed = alarms.lastSync?.status === 'error';
  const notificationsOn = notifications === 'granted';
  const exactOn = exactAlarms === 'granted';
  const next = alarms.next;

  const sendTest = async () => {
    setBusy(true);
    const result = await alarms.sendTest();
    setBusy(false);
    if (!result) return;
    setTestMessage(
      result.status === 'scheduled' ? 'A test alert is set. Close the app now: it will ring in 10 seconds.'
        : result.status === 'no-permission' ? 'Allow notifications first, then try the test again.'
          : 'The test alert could not be set. Please try again.',
    );
  };

  return (
    <section role="region" aria-label="Prayer alerts" className="rounded-3xl p-4 space-y-3" style={surface}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0" style={{ color: notificationsOn ? 'var(--color-text-brand)' : 'var(--color-text-muted)' }} aria-hidden="true">
          {notificationsOn ? <BellRing className="w-6 h-6" /> : <BellOff className="w-6 h-6" />}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-black" style={{ color: 'var(--color-text-primary)' }}>
            {failed ? 'Prayer alerts could not be set' : notificationsOn ? 'Prayer alerts are on' : 'Prayer alerts are off'}
          </h2>
          {failed && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              Something went wrong setting your alerts on this phone. Try again, or open the app again a little later.
            </p>
          )}
          {notificationsOn && !failed && next && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              Next alert: {next.title}, {dayWord(next.at, now())} at {clock(next.at)}
            </p>
          )}
          {!notificationsOn && !failed && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              Allow notifications so the call to prayer and your reminders can ring when the app is closed.
              {notifications === 'denied' && ' Notifications are blocked for Muneeb: turn them on in your phone\'s Settings, under Apps, Muneeb, Notifications.'}
            </p>
          )}
        </div>
      </div>

      {failed && (
        <button type="button" onClick={() => { void alarms.resync(); }} className={action} style={{ background: 'var(--color-brand-500)' }}>
          Try again
        </button>
      )}

      {!notificationsOn && (
        <button type="button" onClick={() => { void alarms.requestNotifications(); }} className={action} style={{ background: 'var(--color-brand-500)' }}>
          Allow notifications
        </button>
      )}

      {notificationsOn && !exactOn && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Without exact timing, Android may deliver alerts several minutes late. Allow "Alarms and reminders" for Muneeb.
          </p>
          <button type="button" onClick={() => { void alarms.openExactSettings(); }} className={action} style={{ background: 'var(--color-brand-500)' }}>
            Allow exact timing
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => { void sendTest(); }}
        disabled={busy}
        aria-busy={busy}
        className="min-h-11 w-full rounded-xl px-4 text-sm font-bold cursor-pointer disabled:opacity-60"
        style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
      >
        Send a test alert
      </button>
      {testMessage && (
        <p role="status" className="text-xs font-bold" style={{ color: 'var(--color-text-brand)' }}>{testMessage}</p>
      )}

      <details className="group text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        <summary
          className="min-h-11 flex items-center justify-between gap-2 rounded-xl px-3 cursor-pointer font-bold list-none [&::-webkit-details-marker]:hidden"
          style={{ color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
        >
          <span>If alerts do not arrive</span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="space-y-2 px-1 pt-2 pb-2">
          <p>Some phones stop apps from running in the background to save battery. On Xiaomi, POCO and Redmi phones:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Open Settings, then Apps, then Muneeb.</li>
            <li>Turn on Autostart.</li>
            <li>Under Battery saver, choose No restrictions.</li>
          </ol>
          <p>On other phones, look for a similar battery or background setting for Muneeb, and allow it to run in the background.</p>
          <p>Alerts are set 10 days ahead each time you open Muneeb, so open it at least once every 10 days.</p>
        </div>
      </details>
    </section>
  );
}
