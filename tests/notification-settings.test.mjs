import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

process.env.NODE_ENV = 'development';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.test/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { render, screen, fireEvent, cleanup, act } = await import('@testing-library/react');
const { default: NotificationSettings } = await import('../src/components/NotificationSettings.tsx');

const installNotification = ({ permission, onRequest, shown }) => {
  class FakeNotification { constructor(title, options) { shown?.push([title, options]); } }
  FakeNotification.permission = permission;
  FakeNotification.requestPermission = async () => { onRequest?.(); FakeNotification.permission = 'granted'; return 'granted'; };
  globalThis.Notification = FakeNotification;
};

test.afterEach(() => { cleanup(); delete globalThis.Notification; });

const status = () => document.getElementById('notification_status').textContent;

test('when notifications are unsupported the card says so and offers nothing', () => {
  render(React.createElement(NotificationSettings));
  assert.match(status(), /not supported/i);
  assert.equal(document.getElementById('btn_enable_notifications'), null);
});

test('not yet asked: an enable button requests permission and then shows the on state', async () => {
  let asked = 0;
  installNotification({ permission: 'default', onRequest: () => { asked += 1; } });
  render(React.createElement(NotificationSettings));
  assert.match(status(), /off/i);
  await act(async () => { fireEvent.click(document.getElementById('btn_enable_notifications')); });
  assert.equal(asked, 1);
  assert.match(status(), /on/i);
  assert.equal(document.getElementById('btn_enable_notifications'), null);
});

test('blocked: explains how to unblock instead of offering a dead button', () => {
  installNotification({ permission: 'denied' });
  render(React.createElement(NotificationSettings));
  assert.match(status(), /blocked/i);
  assert.equal(document.getElementById('btn_enable_notifications'), null);
});

test('granted: a test notification can be sent', async () => {
  const shown = [];
  installNotification({ permission: 'granted', shown });
  render(React.createElement(NotificationSettings));
  await act(async () => { fireEvent.click(document.getElementById('btn_test_notification')); });
  assert.equal(shown.length, 1);
  assert.match(document.getElementById('notification_note').textContent, /app is closed|closed/i, 'is honest about closed-app limits');
});
