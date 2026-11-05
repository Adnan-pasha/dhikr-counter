import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ADHAN_SOUND, REMINDER_SOUND, SMALL_ICON } from '../src/alarmSync.ts';

const root = new URL('../', import.meta.url);
const res = 'android/app/src/main/res';
const bytes = (p) => fs.readFileSync(new URL(p, root));

test('the adhan sound named in the code is a real MP3 in the Android resources, of sensible size', () => {
  assert.equal(ADHAN_SOUND, 'azan_hayya.mp3');
  const file = bytes(`${res}/raw/${ADHAN_SOUND}`);
  const header = file.subarray(0, 3).toString('latin1');
  assert.ok(header === 'ID3' || (file[0] === 0xff && (file[1] & 0xe0) === 0xe0), 'an MP3 header');
  assert.ok(file.length > 200_000 && file.length < 2_000_000, `size ${file.length}`);
});

test('the reminder chime named in the code is a real short Ogg file', () => {
  assert.equal(REMINDER_SOUND, 'reminder_chime.ogg');
  const file = bytes(`${res}/raw/${REMINDER_SOUND}`);
  assert.equal(file.subarray(0, 4).toString('latin1'), 'OggS');
  assert.ok(file.length > 1_000 && file.length < 100_000, `size ${file.length}`);
});

test('Android only accepts lower-case letters, digits and underscores in resource names', () => {
  for (const name of [ADHAN_SOUND, REMINDER_SOUND, SMALL_ICON]) {
    assert.match(name.replace(/\.[a-z0-9]+$/, ''), /^[a-z][a-z0-9_]*$/, name);
  }
});

test('the status-bar icon exists at every density, as a PNG of the right size', () => {
  const sizes = { mdpi: 24, hdpi: 36, xhdpi: 48, xxhdpi: 72, xxxhdpi: 96 };
  for (const [density, size] of Object.entries(sizes)) {
    const file = bytes(`${res}/drawable-${density}/${SMALL_ICON}.png`);
    assert.equal(file.subarray(1, 4).toString('latin1'), 'PNG', density);
    assert.equal(file.readUInt32BE(16), size, `${density} width`);
    assert.equal(file.readUInt32BE(20), size, `${density} height`);
  }
});

test('the plugin is told which icon and colour to use, and the app depends on the plugin', () => {
  const config = bytes('capacitor.config.ts').toString('utf8');
  assert.match(config, /LocalNotifications:\s*\{/);
  assert.match(config, new RegExp(`smallIcon: '${SMALL_ICON}'`));
  assert.match(config, /iconColor: '#[0-9A-Fa-f]{6}'/);
  const pkg = JSON.parse(bytes('package.json').toString('utf8'));
  assert.ok(pkg.dependencies['@capacitor/local-notifications'], 'listed as a dependency');
});

test('the manifest keeps the permissions the alerts need, directly or through the plugin', () => {
  const plugin = bytes('node_modules/@capacitor/local-notifications/android/src/main/AndroidManifest.xml').toString('utf8');
  for (const permission of ['POST_NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM', 'RECEIVE_BOOT_COMPLETED']) {
    assert.match(plugin, new RegExp(`android.permission.${permission}`), permission);
  }
  assert.match(plugin, /LocalNotificationRestoreReceiver/, 'alarms come back after the phone restarts');
});
