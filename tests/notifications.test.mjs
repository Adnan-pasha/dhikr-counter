import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNotificationStatus, buildReminderNotification, showReminderNotification, requestNotificationPermission, dhikrIdFromSearch,
} from '../src/notifications.ts';

const reminder = { id: 'rem-1', dhikrId: 'ayatul-kursi', dhikrName: 'Ayatul Kursi', timeString: '05:30', days: ['mon'], label: 'Fajr morning', isEnabled: true };

const envWith = ({ permission = 'granted', swShow, ctorLog, request } = {}) => {
  class FakeNotification {
    constructor(title, options) { ctorLog?.push([title, options]); }
  }
  FakeNotification.permission = permission;
  FakeNotification.requestPermission = request ?? (async () => permission);
  const env = { Notification: FakeNotification };
  // `ready` never settles when no worker is registered, so the code must not wait on it.
  if (swShow) env.navigator = { serviceWorker: { ready: new Promise(() => {}), getRegistration: async () => ({ showNotification: swShow }) } };
  return env;
};

test('status reflects support and permission', () => {
  assert.equal(getNotificationStatus({}), 'unsupported');
  assert.equal(getNotificationStatus(envWith({ permission: 'granted' })), 'granted');
  assert.equal(getNotificationStatus(envWith({ permission: 'denied' })), 'denied');
  assert.equal(getNotificationStatus(envWith({ permission: 'default' })), 'default');
});

test('the reminder notification is titled by its label and carries the dhikr for the tap', () => {
  const n = buildReminderNotification(reminder);
  assert.equal(n.title, 'Fajr morning');
  assert.match(n.options.body, /Ayatul Kursi/);
  assert.equal(n.options.tag, 'reminder-rem-1');
  assert.deepEqual(n.options.data, { dhikrId: 'ayatul-kursi' });
});

test('a reminder without a label still gets a gentle title', () => {
  assert.equal(buildReminderNotification({ ...reminder, label: '  ' }).title, 'Time for dhikr');
});

test('notifications go through the service worker when it is available', async () => {
  const shown = [];
  const ctorLog = [];
  const ok = await showReminderNotification(reminder, envWith({ swShow: async (t, o) => { shown.push([t, o]); }, ctorLog }));
  assert.equal(ok, true);
  assert.equal(shown.length, 1);
  assert.equal(shown[0][0], 'Fajr morning');
  assert.equal(ctorLog.length, 0, 'no duplicate through the constructor');
});

test('without a service worker the page notification is used', async () => {
  const ctorLog = [];
  assert.equal(await showReminderNotification(reminder, envWith({ ctorLog })), true);
  assert.equal(ctorLog.length, 1);
});

test('nothing is shown unless permission is granted', async () => {
  const shown = [];
  for (const permission of ['default', 'denied']) {
    assert.equal(await showReminderNotification(reminder, envWith({ permission, swShow: async () => { shown.push(1); } })), false);
  }
  assert.equal(await showReminderNotification(reminder, {}), false);
  assert.equal(shown.length, 0);
});

test('a failing service worker falls back instead of throwing', async () => {
  const ctorLog = [];
  const env = envWith({ ctorLog });
  env.navigator = { serviceWorker: { ready: new Promise(() => {}), getRegistration: () => Promise.reject(new Error('no sw')) } };
  assert.equal(await showReminderNotification(reminder, env), true);
  assert.equal(ctorLog.length, 1);
});

test('with no worker registered it falls back at once instead of waiting forever', async () => {
  const ctorLog = [];
  const env = envWith({ ctorLog });
  env.navigator = { serviceWorker: { ready: new Promise(() => {}), getRegistration: async () => undefined } };
  assert.equal(await showReminderNotification(reminder, env), true);
  assert.equal(ctorLog.length, 1);
});

test('requesting permission returns the resulting status and tolerates errors', async () => {
  assert.equal(await requestNotificationPermission(envWith({ permission: 'default', request: async () => 'granted' })), 'granted');
  assert.equal(await requestNotificationPermission({}), 'unsupported');
  assert.equal(await requestNotificationPermission(envWith({ permission: 'default', request: async () => { throw new Error('x'); } })), 'default');
});

test('a dhikr id is read from the launch URL', () => {
  assert.equal(dhikrIdFromSearch('?dhikr=ayatul-kursi'), 'ayatul-kursi');
  assert.equal(dhikrIdFromSearch('?a=1&dhikr=subhanallah'), 'subhanallah');
  assert.equal(dhikrIdFromSearch(''), null);
  assert.equal(dhikrIdFromSearch('?dhikr='), null);
  assert.equal(dhikrIdFromSearch('?dhikr=' + 'x'.repeat(200)), null, 'absurdly long ids are ignored');
});
