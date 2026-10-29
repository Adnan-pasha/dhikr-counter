import React from 'react';
import { Bell, BellOff } from 'lucide-react';
import {
  getNotificationStatus, requestNotificationPermission, showReminderNotification, type NotificationStatus,
} from '../notifications';
import type { DhikrReminder } from '../types';

const TEST_REMINDER: DhikrReminder = {
  id: 'test',
  dhikrId: 'subhanallah',
  dhikrName: 'SubhanAllah',
  timeString: '00:00',
  days: [],
  label: 'Test reminder',
  isEnabled: true,
};

const STATUS_TEXT: Record<NotificationStatus, string> = {
  unsupported: 'Notifications are not supported in this browser.',
  default: 'Notifications are off.',
  granted: 'Notifications are on.',
  denied: 'Notifications are blocked. Allow them in your browser or site settings.',
};

/** Shows whether reminder notifications can appear, lets the user turn them on, and sends a test. */
export default function NotificationSettings() {
  const [status, setStatus] = React.useState<NotificationStatus>(() => getNotificationStatus());
  const [testResult, setTestResult] = React.useState<'sent' | 'failed' | null>(null);

  const enable = async () => setStatus(await requestNotificationPermission());
  const sendTest = async () => setTestResult((await showReminderNotification(TEST_REMINDER)) ? 'sent' : 'failed');

  const Icon = status === 'granted' ? Bell : BellOff;

  return (
    <div id="notification_settings" className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" style={{ color: status === 'granted' ? 'var(--color-text-brand)' : 'var(--color-text-muted)' }} />
        <div className="min-w-0">
          <p className="text-xs font-bold" style={{ color: 'var(--color-text-primary)' }}>Reminder notifications</p>
          <p id="notification_status" role="status" className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{STATUS_TEXT[status]}</p>
        </div>
      </div>

      {status === 'default' && (
        <button
          id="btn_enable_notifications"
          type="button"
          onClick={enable}
          className="tap-target w-full rounded-xl text-xs font-black cursor-pointer text-on-brand"
          style={{ background: 'var(--color-brand-500)' }}
        >
          Turn on notifications
        </button>
      )}

      {status === 'granted' && (
        <div className="flex items-center gap-3">
          <button
            id="btn_test_notification"
            type="button"
            onClick={sendTest}
            className="tap-target rounded-xl px-4 text-xs font-bold cursor-pointer"
            style={{ background: 'var(--color-bg-overlay)', color: 'var(--color-text-brand)', border: '1px solid var(--color-border)' }}
          >
            Send a test
          </button>
          {testResult === 'failed' && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Could not show it. Check your device's notification settings.</span>}
        </div>
      )}

      <p id="notification_note" className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
        Reminders appear while Dhikr is open or running in the background. When the app is closed,
        your phone may not deliver them; reliable alarms need the Android app.
      </p>
    </div>
  );
}
