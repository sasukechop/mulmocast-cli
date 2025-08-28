import test from "node:test";
import assert from "node:assert";

import { MulmoBeatMethods } from "../../src/methods/index.js";

test("test localizedText 1", async () => {
  const result = MulmoBeatMethods.localizedText({ text: "hello" });
  assert.equal(result, "hello");
});

test("test localizedText 2", async () => {
  const result = MulmoBeatMethods.localizedText({ text: "hello" }, { multiLingualTexts: { ja: { text: "ハロー" } } });
  assert.equal(result, "hello");
});

test("test localizedText 3", async () => {
  const result = MulmoBeatMethods.localizedText({ text: "hello" }, { multiLingualTexts: { ja: { text: "ハロー" } } }, "ja");
  assert.equal(result, "ハロー");
});

test("test localizedText 4", async () => {
  const result = MulmoBeatMethods.localizedText({ text: "hello" }, { multiLingualTexts: { ja: { text: "ハロー" } } }, "ja", "ja");
  assert.equal(result, "hello");
});
