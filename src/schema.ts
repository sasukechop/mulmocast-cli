import { z } from "zod";

export const langSchema = z.string();
const URLStringSchema = z.string().url();

export const localizedTextSchema = z.object({
  text: z.string(),
  lang: z.string(),
  // caption: z.string(),
  texts: z.array(z.string()),
  ttsTexts: z.array(z.string()),
  duration: z.number(), // generated // video duration time(ms)
  filename: z.string(), // generated //
});

export const multiLingualTextsSchema = z.record(langSchema, localizedTextSchema);

const speakerIdSchema = z.string();

const speakerDataSchema = z.object({
  displayName: z.record(langSchema, z.string()),
  voiceId: z.string(),
});

export const speakerDictionarySchema = z.record(speakerIdSchema, speakerDataSchema);

const mediaSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("url"), url: URLStringSchema }), // https://example.com/foo.pdf
  z.object({ kind: z.literal("data"), data: z.string() }), // base64
  z.object({ kind: z.literal("file"), filename: z.string() }), // foo.pdf
]);

const MulmoMarkdownMediaSchema = z.object({
  type: z.literal("markdown"),
  markdown: z.string(),
});

const MulmoWebMediaSchema = z.object({
  type: z.literal("web"),
  url: URLStringSchema,
});

const MulmoPdfMediaSchema = z.object({
  type: z.literal("pdf"),
  source: mediaSourceSchema,
});

const MulmoImageMediaSchema = z.object({
  type: z.literal("image"),
  source: mediaSourceSchema,
});

const MulmoSvgMediaSchema = z.object({
  type: z.literal("svg"),
  source: mediaSourceSchema,
});

const MulmoMovieMediaSchema = z.object({
  type: z.literal("movie"),
  source: mediaSourceSchema,
});

export const mulmoMediaSchema = z.union([
  MulmoMarkdownMediaSchema,
  MulmoWebMediaSchema,
  MulmoPdfMediaSchema,
  MulmoImageMediaSchema,
  MulmoSvgMediaSchema,
  MulmoMovieMediaSchema,
]);

export const text2imageParamsSchema = z.object({
  model: z.string().optional(), // default: provider specific
  size: z.string().optional(), // default: provider specific
  aspectRatio: z.string().optional(), // default: "16:9"
  style: z.string().optional(), // optional image style
});

export const text2speechParamsSchema = z.object({
  speed: z.number().optional(), // default: 1.0
  instruction: z.string().optional(),
});

export const mulmoBeatSchema = z.object({
  speaker: speakerIdSchema,
  text: z.string(),
  multiLingualTexts: multiLingualTextsSchema,
  media: mulmoMediaSchema.optional(),
  imageParams: text2imageParamsSchema.optional(), // beat specific parameters
  speechParams: text2speechParamsSchema.optional(),
  imagePrompt: z.string().optional(), // specified or inserted by preprocessor
  image: z.string().optional(), // path to the image
  filename: z.string(), // generated
  duration: z.number().optional(), // workaround
});

// export const voiceMapSchema = z.record(speakerIdSchema, z.string())

export const mulmoScriptSchema = z.object({
  // global settings
  title: z.string(),
  description: z.string(),
  reference: z.string(),
  lang: langSchema,

  filename: z.string(), // generated

  // page/slide
  beats: z.array(mulmoBeatSchema),

  // for text2speech
  speechParams: text2speechParamsSchema
    .extend({
      provider: z.string().optional(),
      speakers: speakerDictionarySchema,
    })
    .optional(),

  // for text2image
  imageParams: text2imageParamsSchema
    .extend({
      provider: z.string().optional(),
    })
    .optional(),

  // images: ImageInfo[] // generated
  imagePath: z.string().optional(), // for keynote images movie ??
  omitCaptions: z.boolean().optional(), // default is false

  // for bgm
  padding: z.number().optional(),
});

export const mulmoStudioSchema = z.object({
  script: mulmoScriptSchema,
  beats: z.array(mulmoBeatSchema),
});
