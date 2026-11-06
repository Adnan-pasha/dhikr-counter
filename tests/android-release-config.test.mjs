import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('the app does not hand its data to Android Auto Backup: counts, history and place stay on the device', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /android:allowBackup="false"/);
  assert.doesNotMatch(manifest, /android:allowBackup="true"/);
});

test('cleartext (http) traffic is refused explicitly', () => {
  assert.match(read('android/app/src/main/AndroidManifest.xml'), /android:usesCleartextTraffic="false"/);
});

test('release builds are signed from a keystore.properties file that is not in the repository', () => {
  const gradle = read('android/app/build.gradle');
  assert.match(gradle, /keystore\.properties/);
  assert.match(gradle, /signingConfigs\s*\{[\s\S]*release/);
  assert.match(gradle, /signingConfig\s+signingConfigs\.release/);
  // A password line must read from the properties file, never carry a literal.
  assert.doesNotMatch(gradle, /^\s*(storePassword|keyPassword)\s*=?\s*['"]/m, 'no password written into the build file');
  assert.match(gradle, /^\s*storePassword\s+keystoreProperties\['storePassword'\]/m);
  assert.match(gradle, /^\s*keyPassword\s+keystoreProperties\['keyPassword'\]/m);
});

test('a build without the keystore file still works, for debug and for contributors', () => {
  const gradle = read('android/app/build.gradle');
  assert.match(gradle, /keystorePropertiesFile\.exists\(\)/);
});

test('keystores and their properties file can never be committed', () => {
  for (const file of ['android/.gitignore', '.gitignore']) {
    const ignore = read(file).split('\n').map((line) => line.trim());
    for (const pattern of ['*.jks', '*.keystore', 'keystore.properties']) {
      assert.ok(ignore.includes(pattern), `${file} ignores ${pattern}`);
    }
  }
});

test('the installed web app and the page title carry the Muneeb name, not the old Tasbih one', () => {
  const manifest = JSON.parse(read('public/manifest.json'));
  assert.match(manifest.name, /Muneeb/);
  assert.equal(manifest.short_name, 'Muneeb');
  assert.doesNotMatch(JSON.stringify(manifest), /Tasbih/);
  assert.match(read('index.html'), /<title>[^<]*Muneeb[^<]*<\/title>/);
  assert.doesNotMatch(read('index.html'), /<title>[^<]*Tasbih/);
});

test('the file provider no longer shares the whole of external storage', () => {
  assert.doesNotMatch(read('android/app/src/main/res/xml/file_paths.xml'), /external-path/);
});

test('the release steps are written down', () => {
  const doc = read('docs/RELEASE.md');
  for (const needle of ['keytool', 'keystore.properties', 'Play App Signing', 'exact alarm', 'Data safety', 'privacy policy']) {
    assert.match(doc, new RegExp(needle, 'i'), needle);
  }
});
