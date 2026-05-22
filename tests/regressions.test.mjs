import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("bottom nav uses corrected Settings label", () => {
  const app = readFileSync("src/App.tsx", "utf8");
  assert.match(app, />Options<\/span>/);
  assert.doesNotMatch(app, />Option<\/span>/);
});

test("library card applies overflow guards for long Arabic text", () => {
  const file = readFileSync("src/components/DhikrLibrary.tsx", "utf8");
  assert.match(file, /overflow-hidden/);
  assert.match(file, /min-w-0 pr-3/);
  assert.match(file, /w-\[42%\]/);
  assert.match(file, /max-w-\[180px\]/);
  assert.match(file, /truncate/);
});

test("README no longer points to Gemini API setup", () => {
  const readme = readFileSync("README.md", "utf8");
  assert.doesNotMatch(readme, /GEMINI_API_KEY/);
  assert.match(readme, /Dhikr Counter/);
});
