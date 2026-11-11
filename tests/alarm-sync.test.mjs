import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAlarmSync, ADHAN_SOUND, REMINDER_SOUND, SMALL_ICON, TEST_ALARM_ID, TEST_DELAY_MS,
} from '../src/alarmSync.ts';
import { ADHAN_CHANNEL, REMINDER_CHANNEL } from '../src/nativeAlarms.ts';

/** A phone that records everything it is asked to do. */
const fakePhone = ({ display = 'granted', exact = 'granted', pending = [], failOn = null, delayMs = 0 } = {}) => {
  const log = [];
  const state = { display, exact, pending: [...pending], failOn, prompts: 0 };
  const step = async (name, payload, result) => {
    log.push([`${name}:start`, payload]);
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    if (state.failOn === name) throw new Error(`${name} failed`);
    log.push([`${name}:end`, payload]);
    return result;
  };
  return {
    log, state,
    checkPermissions: () => step('checkPermissions', null, { display: state.display }),
    requestPermissions: async () => { state.display = 'granted'; return step('requestPermissions', null, { display: state.display }); },
    checkExactNotificationSetting: () => step('checkExact', null, { exact_alarm: state.exact }),
    changeExactNotificationSetting: () => step('changeExact', null, { exact_alarm: state.exact }),
    createChannel: (c) => step('createChannel', c),
    getPending: () => step('getPending', null, { notifications: state.pending.map((id) => ({ id })) }),
    cancel: (o) => step('cancel', o),
    // The real plugin opens the system "Alarms & reminders" screen when a notification asks for an exact alarm that is not allowed.
    schedule: (o) => {
      if (o.notifications.some((n) => n.isExactNotification !== false) && state.exact !== 'granted') state.prompts += 1;
      return step('schedule', o, { notifications: o.notifications.map((n) => ({ id: n.id })) });
    },
  };
};

const alarm = (id, minutes, over = {}) => ({
  id, kind: 'adhan', at: new Date(Date.UTC(2026, 2, 10, 12, minutes)), title: 'Asr', body: 'It is time for Asr prayer.',
  channelId: ADHAN_CHANNEL, extra: { kind: 'adhan', prayer: 'asr', dateKey: '2026-03-10' }, ...over,
});
const calls = (phone, name) => phone.log.filter(([n]) => n === `${name}:end`).map(([, p]) => p);

test('without permission to show notifications nothing is cancelled or scheduled, and it says why', async () => {
  const phone = fakePhone({ display: 'denied', pending: [1, 2] });
  const result = await createAlarmSync(phone).sync([alarm(1, 0)]);
  assert.equal(result.status, 'no-permission');
  assert.equal(result.scheduled, 0);
  assert.equal(calls(phone, 'schedule').length, 0);
  assert.equal(calls(phone, 'cancel').length, 0, 'what is already set is left alone');
});

test('both channels are made: the adhan one with the hayya clip at the loudest level, the reminders one with its chime', async () => {
  const phone = fakePhone();
  await createAlarmSync(phone).sync([alarm(1, 0)]);
  const [adhan, reminders] = calls(phone, 'createChannel');
  assert.equal(adhan.id, ADHAN_CHANNEL);
  assert.equal(adhan.sound, ADHAN_SOUND);
  assert.equal(adhan.sound, 'azan_hayya.mp3');
  assert.equal(adhan.importance, 5);
  assert.equal(adhan.vibration, true);
  assert.equal(adhan.visibility, 1);
  assert.equal(reminders.id, REMINDER_CHANNEL);
  assert.equal(reminders.sound, REMINDER_SOUND);
  assert.equal(reminders.importance, 4);
});

test('old alarms are cancelled first, then the new plan is scheduled', async () => {
  const phone = fakePhone({ pending: [10, 11, 12] });
  const result = await createAlarmSync(phone).sync([alarm(1, 0), alarm(2, 5)]);
  const order = phone.log.map(([n]) => n).filter((n) => n.endsWith(':end') && ['cancel:end', 'schedule:end'].includes(n));
  assert.deepEqual(order, ['cancel:end', 'schedule:end'], 'cancel before schedule');
  assert.deepEqual(calls(phone, 'cancel')[0], { notifications: [{ id: 10 }, { id: 11 }, { id: 12 }] });
  assert.equal(result.status, 'scheduled');
  assert.equal(result.scheduled, 2);
});

test('each alarm is handed over with its time, the channel, and permission to fire while the phone is dozing', async () => {
  const phone = fakePhone();
  const a = alarm(7, 30);
  await createAlarmSync(phone).sync([a]);
  const [{ notifications }] = calls(phone, 'schedule');
  assert.equal(notifications.length, 1);
  const sent = notifications[0];
  assert.equal(sent.id, 7);
  assert.equal(sent.title, 'Asr');
  assert.equal(sent.body, a.body);
  assert.equal(sent.channelId, ADHAN_CHANNEL);
  assert.equal(sent.schedule.at.getTime(), a.at.getTime());
  assert.equal(sent.schedule.allowWhileIdle, true);
  assert.deepEqual(sent.extra, a.extra);
  assert.equal(sent.smallIcon, SMALL_ICON);
});

test('with nothing pending it does not ask to cancel an empty list', async () => {
  const phone = fakePhone({ pending: [] });
  await createAlarmSync(phone).sync([alarm(1, 0)]);
  assert.equal(calls(phone, 'cancel').length, 0);
});

test('an empty plan clears what was set and schedules nothing', async () => {
  const phone = fakePhone({ pending: [5] });
  const result = await createAlarmSync(phone).sync([]);
  assert.equal(calls(phone, 'cancel').length, 1);
  assert.equal(calls(phone, 'schedule').length, 0, 'no empty schedule call');
  assert.deepEqual([result.status, result.scheduled], ['scheduled', 0]);
});

test('it reports whether Android will deliver on time', async () => {
  assert.equal((await createAlarmSync(fakePhone({ exact: 'granted' })).sync([alarm(1, 0)])).exact, true);
  assert.equal((await createAlarmSync(fakePhone({ exact: 'denied' })).sync([alarm(1, 0)])).exact, false);
});

test('a failure on the phone is reported, never thrown, so the app carries on', async () => {
  for (const failOn of ['createChannel', 'getPending', 'cancel', 'schedule']) {
    const phone = fakePhone({ pending: [1], failOn });
    const result = await createAlarmSync(phone).sync([alarm(1, 0)]);
    assert.equal(result.status, 'error', failOn);
    assert.match(result.error, new RegExp(failOn), failOn);
  }
});

test('two syncs at once do not interleave: the second starts after the first has finished', async () => {
  const phone = fakePhone({ pending: [1], delayMs: 3 });
  const sync = createAlarmSync(phone);
  await Promise.all([sync.sync([alarm(1, 0)]), sync.sync([alarm(2, 5)])]);
  const names = phone.log.map(([n]) => n);
  const firstEnd = names.indexOf('schedule:end');
  const secondStart = names.indexOf('schedule:start', firstEnd);
  const secondCheck = names.indexOf('checkPermissions:start', 1);
  assert.ok(secondCheck > firstEnd, 'the second sync began only after the first finished its schedule call');
  assert.ok(secondStart > firstEnd);
});

test('one failed sync does not block the next one on the same connection', async () => {
  const phone = fakePhone({ failOn: 'schedule' });
  const sync = createAlarmSync(phone);
  assert.equal((await sync.sync([alarm(1, 0)])).status, 'error');
  phone.state.failOn = null; // the phone recovers
  assert.equal((await sync.sync([alarm(1, 0)])).status, 'scheduled');
});

// ── permission status and requests ───────────────────────────────────────────

test('status reads both permissions', async () => {
  const status = await createAlarmSync(fakePhone({ display: 'prompt', exact: 'denied' })).status();
  assert.deepEqual(status, { notifications: 'prompt', exactAlarms: 'denied' });
});

test('status falls back to "prompt" for anything it cannot read, and never throws', async () => {
  const broken = { ...fakePhone(), checkPermissions: async () => { throw new Error('x'); }, checkExactNotificationSetting: async () => { throw new Error('y'); } };
  assert.deepEqual(await createAlarmSync(broken).status(), { notifications: 'prompt', exactAlarms: 'prompt' });
});

test('asking for notification permission returns the answer', async () => {
  const phone = fakePhone({ display: 'prompt' });
  assert.equal(await createAlarmSync(phone).requestNotifications(), 'granted');
});

test('the exact-alarm settings screen is opened on request', async () => {
  const phone = fakePhone({ exact: 'denied' });
  assert.equal(await createAlarmSync(phone).openExactAlarmSettings(), 'denied');
  assert.equal(calls(phone, 'changeExact').length, 1);
});

// ── the test notification ────────────────────────────────────────────────────

test('the test alert is set for ten seconds ahead on the adhan channel, with an id the planner reserves', async () => {
  const phone = fakePhone();
  const now = new Date('2026-03-10T12:00:00Z');
  const result = await createAlarmSync(phone).scheduleTest(now);
  assert.equal(result.status, 'scheduled');
  const [{ notifications }] = calls(phone, 'schedule');
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].id, TEST_ALARM_ID);
  assert.equal(notifications[0].schedule.at.getTime(), now.getTime() + TEST_DELAY_MS);
  assert.equal(TEST_DELAY_MS, 10_000);
  assert.equal(notifications[0].channelId, ADHAN_CHANNEL);
  assert.equal(notifications[0].extra.kind, 'test');
  assert.equal(calls(phone, 'cancel').length, 0, 'the real schedule is not touched');
});

test('the test alert without permission asks for nothing and says so', async () => {
  const phone = fakePhone({ display: 'denied' });
  assert.equal((await createAlarmSync(phone).scheduleTest(new Date())).status, 'no-permission');
  assert.equal(calls(phone, 'schedule').length, 0);
});

test('a test alert still waiting for its ten seconds is not cancelled by a sync', async () => {
  const phone = fakePhone({ pending: [10, TEST_ALARM_ID, 12] });
  await createAlarmSync(phone).sync([alarm(1, 0)]);
  assert.deepEqual(calls(phone, 'cancel')[0], { notifications: [{ id: 10 }, { id: 12 }] });
});

test('when only the test alert is pending there is nothing to cancel', async () => {
  const phone = fakePhone({ pending: [TEST_ALARM_ID] });
  await createAlarmSync(phone).sync([alarm(1, 0)]);
  assert.equal(calls(phone, 'cancel').length, 0);
});

// ── never throw the person into the system settings screen on their own ──────

test('without the exact-alarm permission the alarms are scheduled as inexact and the settings screen is never opened', async () => {
  const phone = fakePhone({ exact: 'denied' });
  await createAlarmSync(phone).sync([alarm(1, 0), alarm(2, 5)]);
  const [{ notifications }] = calls(phone, 'schedule');
  assert.ok(notifications.every((n) => n.isExactNotification === false));
  assert.equal(phone.state.prompts, 0, 'no system prompt');
});

test('with the permission they are scheduled as exact', async () => {
  const phone = fakePhone({ exact: 'granted' });
  await createAlarmSync(phone).sync([alarm(1, 0)]);
  const [{ notifications }] = calls(phone, 'schedule');
  assert.ok(notifications.every((n) => n.isExactNotification === true));
  assert.equal(phone.state.prompts, 0);
});

test('"prompt" counts as not allowed: still no system screen', async () => {
  const phone = fakePhone({ exact: 'prompt' });
  await createAlarmSync(phone).sync([alarm(1, 0)]);
  assert.equal(phone.state.prompts, 0);
  assert.equal(calls(phone, 'schedule')[0].notifications[0].isExactNotification, false);
});

test('the permission is read before anything is scheduled', async () => {
  const phone = fakePhone();
  await createAlarmSync(phone).sync([alarm(1, 0)]);
  const names = phone.log.map(([n]) => n);
  assert.ok(names.indexOf('checkExact:end') < names.indexOf('schedule:start'));
});

test('if the permission cannot be read, it is treated as not allowed rather than failing the sync', async () => {
  const phone = { ...fakePhone(), checkExactNotificationSetting: async () => { throw new Error('unreadable'); } };
  const result = await createAlarmSync(phone).sync([alarm(1, 0)]);
  assert.equal(result.status, 'scheduled');
  assert.equal(result.exact, false);
});

test('the test alert also never opens the system screen', async () => {
  const phone = fakePhone({ exact: 'denied' });
  await createAlarmSync(phone).scheduleTest(new Date());
  assert.equal(phone.state.prompts, 0);
  assert.equal(calls(phone, 'schedule')[0].notifications[0].isExactNotification, false);
});

test('only the Allow exact timing button opens the system screen', async () => {
  const phone = fakePhone({ exact: 'denied' });
  const sync = createAlarmSync(phone);
  await sync.sync([alarm(1, 0)]);
  await sync.scheduleTest(new Date());
  assert.equal(calls(phone, 'changeExact').length, 0);
  await sync.openExactAlarmSettings();
  assert.equal(calls(phone, 'changeExact').length, 1);
});

// ── Capacitor's plugin objects answer EVERY property name with a method, `then` included ──

import { toAlarmPort } from '../src/alarmSync.ts';

/** Behaves like a real Capacitor plugin proxy: any property is a callable, so resolving a promise with it calls `then` and fails. */
const capacitorLikePlugin = () => {
  const received = [];
  const proxy = new Proxy({}, {
    get: (_, property) => {
      if (property === 'then') return () => { throw new Error('"LocalNotifications.then()" is not implemented on android'); };
      return (...args) => { received.push([String(property), args]); return Promise.resolve({ display: 'granted', exact_alarm: 'granted', notifications: [] }); };
    },
  });
  return { proxy, received };
};

test('a Capacitor plugin proxy cannot be handed back from an async function: that is why the adapter exists', async () => {
  const { proxy } = capacitorLikePlugin();
  const handBackTheProxy = async () => proxy;
  await assert.rejects(handBackTheProxy(), /then\(\)" is not implemented/);
});

test('the adapter can be returned from an async function and awaited without any trouble', async () => {
  const { proxy } = capacitorLikePlugin();
  const resolveWithAdapter = async () => toAlarmPort(proxy);
  const port = await resolveWithAdapter();
  assert.equal(typeof port.schedule, 'function');
  assert.equal(port.then, undefined, 'it is not a thenable');
});

test('the adapter passes every call straight through to the plugin, with its arguments and its answer', async () => {
  const { proxy, received } = capacitorLikePlugin();
  const port = toAlarmPort(proxy);
  assert.deepEqual(await port.checkPermissions(), { display: 'granted', exact_alarm: 'granted', notifications: [] });
  await port.requestPermissions();
  await port.checkExactNotificationSetting();
  await port.changeExactNotificationSetting();
  await port.createChannel({ id: 'c' });
  await port.getPending();
  await port.cancel({ notifications: [{ id: 1 }] });
  await port.schedule({ notifications: [{ id: 2 }] });
  assert.deepEqual(received.map(([name]) => name), [
    'checkPermissions', 'requestPermissions', 'checkExactNotificationSetting', 'changeExactNotificationSetting',
    'createChannel', 'getPending', 'cancel', 'schedule',
  ]);
  assert.deepEqual(received.find(([name]) => name === 'cancel')[1], [{ notifications: [{ id: 1 }] }]);
  assert.deepEqual(received.find(([name]) => name === 'schedule')[1], [{ notifications: [{ id: 2 }] }]);
});

test('a full sync works through the adapter over a plugin that behaves like Capacitor\'s', async () => {
  const { proxy, received } = capacitorLikePlugin();
  const result = await createAlarmSync(toAlarmPort(proxy)).sync([alarm(1, 0)]);
  assert.equal(result.status, 'scheduled');
  assert.ok(received.some(([name]) => name === 'schedule'));
});

// ── not redoing work the phone already has ──

const holds = (phone, ...ids) => { phone.state.pending = ids; phone.log.length = 0; };

test('when the phone already holds exactly the planned alarms, a second sync cancels and schedules nothing', async () => {
  const phone = fakePhone();
  const sync = createAlarmSync(phone);
  const plan = [alarm(1, 0), alarm(2, 5)];
  await sync.sync(plan);
  holds(phone, 1, 2);
  const result = await sync.sync(plan);
  assert.equal(result.status, 'scheduled');
  assert.equal(result.scheduled, 2);
  assert.equal(calls(phone, 'schedule').length, 0);
  assert.equal(calls(phone, 'cancel').length, 0);
});

test('an alarm that moved in time, with the same id, is set again', async () => {
  const phone = fakePhone();
  const sync = createAlarmSync(phone);
  await sync.sync([alarm(1, 0), alarm(2, 5)]);
  holds(phone, 1, 2);
  await sync.sync([alarm(1, 30), alarm(2, 5)]);
  assert.equal(calls(phone, 'schedule').length, 1);
  assert.equal(calls(phone, 'cancel').length, 1);
});

test('a new alarm in the plan is set, and the old ones are replaced with it', async () => {
  const phone = fakePhone();
  const sync = createAlarmSync(phone);
  await sync.sync([alarm(1, 0), alarm(2, 5)]);
  holds(phone, 1, 2);
  await sync.sync([alarm(1, 0), alarm(3, 9)]);
  assert.deepEqual(calls(phone, 'schedule')[0].notifications.map((n) => n.id), [1, 3]);
});

test('an alarm the phone has lost (it fired, or was cleared) is brought back', async () => {
  const phone = fakePhone();
  const sync = createAlarmSync(phone);
  const plan = [alarm(1, 0), alarm(2, 5)];
  await sync.sync(plan);
  holds(phone, 1);
  await sync.sync(plan);
  assert.equal(calls(phone, 'schedule').length, 1);
});

test('allowing exact timing since the last sync sets the alarms again, now as exact', async () => {
  const phone = fakePhone({ exact: 'denied' });
  const sync = createAlarmSync(phone);
  const plan = [alarm(1, 0)];
  await sync.sync(plan);
  phone.state.exact = 'granted';
  holds(phone, 1);
  await sync.sync(plan);
  const scheduled = calls(phone, 'schedule');
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].notifications[0].isExactNotification, true);
});

test('after the app restarts it cannot know what it set last time, so it sets everything again', async () => {
  const phone = fakePhone({ pending: [1, 2] });
  const result = await createAlarmSync(phone).sync([alarm(1, 0), alarm(2, 5)]);
  assert.equal(result.status, 'scheduled');
  assert.equal(calls(phone, 'schedule').length, 1);
});

test('a sync that failed is never remembered as done', async () => {
  const phone = fakePhone();
  const sync = createAlarmSync(phone);
  const plan = [alarm(1, 0)];
  phone.state.failOn = 'schedule';
  assert.equal((await sync.sync(plan)).status, 'error');
  phone.state.failOn = null;
  holds(phone, 1);
  await sync.sync(plan);
  assert.equal(calls(phone, 'schedule').length, 1);
});
