import { validateMulmoScriptAgent } from "../../src/agents/validate_mulmo_script_agent";
import test from "node:test";
import assert from "node:assert";
import type { GraphAI } from "graphai";

const validMulmoScriptJson = JSON.stringify({
  title: "Test Script",
  description: "MulmoScript for testing",
  reference: "None",
  lang: "ja",
  filename: "test.json",
  beats: [
    {
      speaker: "speaker1",
      text: "Hello, this is a test",
      multiLingualTexts: {
        ja: {
          text: "こんにちは、これはテストです",
          lang: "ja",
          texts: ["こんにちは、", "これはテストです"],
          ttsTexts: ["こんにちは、これはテストです"],
          duration: 2000,
          filename: "test_ja_001.mp3",
        },
        en: {
          text: "Hello, this is a test",
          lang: "en",
          texts: ["Hello, ", "this is a test"],
          ttsTexts: ["Hello, this is a test"],
          duration: 1800,
          filename: "test_en_001.mp3",
        },
      },
      media: {
        type: "image",
        source: {
          kind: "url",
          url: "https://example.com/test-image.jpg",
        },
      },
      imageParams: {
        model: "dall-e-3",
        size: "1024x1024",
        aspectRatio: "1:1",
      },
      speechParams: {
        speed: 1.0,
        instruction: "Speak clearly",
      },
      imagePrompt: "A test image showing something interesting",
      image: "test_image_001.jpg",
      filename: "test_001.mp3",
      duration: 2000,
    },
  ],
  speechParams: {
    provider: "openai",
    speed: 1.0,
    instruction: "Speak naturally",
    speakers: {
      speaker1: {
        displayName: {
          ja: "スピーカー 1",
          en: "Speaker 1",
        },
        voiceId: "voice-123",
      },
    },
  },
  imageParams: {
    model: "dall-e-3",
    provider: "openai",
    size: "1792x1024",
    aspectRatio: "16:9",
    style: "natural",
  },
  imagePath: "images/",
  omitCaptions: false,
  padding: 500,
});

const invalidMulmoScriptJson = JSON.stringify({
  title: "Incomplete Script",
  description: "Incomplete MulmoScript for testing",
  lang: "ja",
  beats: [],
});

const baseParams = {
  params: {},
  debugInfo: {
    verbose: false,
    nodeId: "",
    state: "",
    retry: 0,
    subGraphs: new Map<string, GraphAI>(),
  },
  filterParams: {},
};

test("validateMulmoScriptAgent with valid MulmoScript", async () => {
  const result = await validateMulmoScriptAgent({
    ...baseParams,
    namedInputs: { text: validMulmoScriptJson },
  });
  assert(result);
  assert(result.isValid === true);
  assert(result.data !== null);
});

test("validateMulmoScriptAgent with invalid MulmoScript", async () => {
  const result = await validateMulmoScriptAgent({
    ...baseParams,
    namedInputs: { text: invalidMulmoScriptJson },
  });

  assert(result);
  assert.strictEqual(result.isValid, false);
  assert.ok(result.error);
});
