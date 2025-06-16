import dotenv from "dotenv";
import fs from "fs";
import { GraphAI, GraphAILogger } from "graphai";
import { TaskManager } from "graphai/lib/task_manager.js";
import type { GraphOptions, GraphData, CallbackFunction } from "graphai";
import * as agents from "@graphai/vanilla";

import { fileWriteAgent } from "@graphai/vanilla_node_agents";

import { MulmoStudioContext, MulmoBeat, MulmoStudioBeat, MulmoImageParams, Text2ImageAgentInfo } from "../types/index.js";
import { getOutputStudioFilePath, mkdir } from "../utils/file.js";
import { fileCacheAgentFilter } from "../utils/filters.js";
import { imageGoogleAgent, imageOpenaiAgent, movieGoogleAgent, mediaMockAgent } from "../agents/index.js";
import { MulmoPresentationStyleMethods, MulmoStudioContextMethods } from "../methods/index.js";
import { imagePlugins } from "../utils/image_plugins/index.js";

import { imagePrompt } from "../utils/prompt.js";

const vanillaAgents = agents.default ?? agents;

dotenv.config();
// const openai = new OpenAI();
import { GoogleAuth } from "google-auth-library";
import { extractImageFromMovie } from "../utils/ffmpeg_utils.js";

const htmlStyle = (context: MulmoStudioContext, beat: MulmoBeat) => {
  return {
    canvasSize: MulmoPresentationStyleMethods.getCanvasSize(context.presentationStyle),
    textSlideStyle: MulmoPresentationStyleMethods.getTextSlideStyle(context.presentationStyle, beat),
  };
};

export const imagePreprocessAgent = async (namedInputs: {
  context: MulmoStudioContext;
  beat: MulmoBeat;
  index: number;
  suffix: string;
  imageDirPath: string;
  imageAgentInfo: Text2ImageAgentInfo;
  imageRefs: Record<string, string>;
}) => {
  const { context, beat, index, suffix, imageDirPath, imageAgentInfo, imageRefs } = namedInputs;
  const imageParams = { ...imageAgentInfo.imageParams, ...beat.imageParams };
  const imagePath = `${imageDirPath}/${context.studio.filename}/${index}${suffix}.png`;
  const returnValue = {
    imageParams,
    movieFile: beat.moviePrompt ? `${imageDirPath}/${context.studio.filename}/${index}.mov` : undefined,
  };

  MulmoStudioContextMethods.setBeatSessionState(context, "image", index, true);
  if (beat.image) {
    const plugin = imagePlugins.find((plugin) => plugin.imageType === beat?.image?.type);
    if (plugin) {
      try {
        const processorParams = { beat, context, imagePath, ...htmlStyle(context, beat) };
        const path = await plugin.process(processorParams);
        // undefined prompt indicates that image generation is not needed
        return { imagePath: path, referenceImage: path, ...returnValue };
      } finally {
        // nothing
      }
    }
  }

  // images for "edit_image"
  const images = (() => {
    const imageNames = beat.imageNames ?? Object.keys(imageRefs); // use all images if imageNames is not specified
    const sources = imageNames.map((name) => imageRefs[name]);
    return sources.filter((source) => source !== undefined);
  })();

  if (beat.moviePrompt && !beat.imagePrompt) {
    return { ...returnValue, imagePath, images, imageFromMovie: true }; // no image prompt, only movie prompt
  }
  const prompt = imagePrompt(beat, imageParams.style);
  return { imagePath, referenceImage: imagePath, prompt, ...returnValue, images };
};

const beat_graph_data = {
  version: 0.5,
  concurrency: 4,
  nodes: {
    context: {},
    imageDirPath: {},
    imageAgentInfo: {},
    movieAgentInfo: {},
    imageRefs: {},
    beat: {},
    __mapIndex: {},
    preprocessor: {
      agent: imagePreprocessAgent,
      inputs: {
        context: ":context",
        beat: ":beat",
        index: ":__mapIndex",
        suffix: "p",
        imageDirPath: ":imageDirPath",
        imageAgentInfo: ":imageAgentInfo",
        imageRefs: ":imageRefs",
      },
    },
    imageGenerator: {
      if: ":preprocessor.prompt",
      agent: ":imageAgentInfo.agent",
      retry: 3,
      inputs: {
        prompt: ":preprocessor.prompt",
        images: ":preprocessor.images",
        file: ":preprocessor.imagePath", // only for fileCacheAgentFilter
        text: ":preprocessor.prompt", // only for fileCacheAgentFilter
        force: ":context.force", // only for fileCacheAgentFilter
        mulmoContext: ":context", // for fileCacheAgentFilter
        index: ":__mapIndex", // for fileCacheAgentFilter
        sessionType: "image", // for fileCacheAgentFilter
        params: {
          model: ":preprocessor.imageParams.model",
          moderation: ":preprocessor.imageParams.moderation",
          canvasSize: ":context.presentationStyle.canvasSize",
        },
      },
      defaultValue: {},
    },
    movieGenerator: {
      if: ":preprocessor.movieFile",
      agent: ":movieAgentInfo.agent",
      inputs: {
        onComplete: ":imageGenerator", // to wait for imageGenerator to finish
        prompt: ":beat.moviePrompt",
        imagePath: ":preprocessor.referenceImage",
        file: ":preprocessor.movieFile",
        studio: ":context.studio", // for cache
        mulmoContext: ":context", // for fileCacheAgentFilter
        index: ":__mapIndex", // for cache
        sessionType: "movie", // for cache
        params: {
          model: ":context.presentationStyle.movieParams.model",
          duration: ":beat.duration",
          canvasSize: ":context.presentationStyle.canvasSize",
        },
      },
      defaultValue: {},
    },
    imageFromMovie: {
      if: ":preprocessor.imageFromMovie",
      agent: async (namedInputs: { movieFile: string; imageFile: string }) => {
        await extractImageFromMovie(namedInputs.movieFile, namedInputs.imageFile);
        return { generatedImage: true };
      },
      inputs: {
        onComplete: ":movieGenerator", // to wait for movieGenerator to finish
        imageFile: ":preprocessor.imagePath",
        movieFile: ":preprocessor.movieFile",
      },
      defaultValue: { generatedImage: false },
    },
    setState: {
      agent: async ({ context, index }: { context: MulmoStudioContext; index: number }) => {
        MulmoStudioContextMethods.setBeatSessionState(context, "image", index, false);
      },
      inputs: {
        onComplete: ":imageFromMovie", // to wait for imageFromMovie to finish
        context: ":context",
        index: ":__mapIndex",
      },
    },
    output: {
      agent: "copyAgent",
      inputs: {
        onComplete: ":imageFromMovie", // to wait for imageFromMovie to finish
        imageFile: ":preprocessor.imagePath",
        movieFile: ":preprocessor.movieFile",
      },
      output: {
        imageFile: ".imageFile",
        movieFile: ".movieFile",
      },
      isResult: true,
    },
  },
};

const graph_data: GraphData = {
  version: 0.5,
  concurrency: 4,
  nodes: {
    context: {},
    imageDirPath: {},
    imageAgentInfo: {},
    movieAgentInfo: {},
    outputStudioFilePath: {},
    imageRefs: {},
    map: {
      agent: "mapAgent",
      inputs: {
        rows: ":context.studio.script.beats",
        context: ":context",
        imageAgentInfo: ":imageAgentInfo",
        movieAgentInfo: ":movieAgentInfo",
        imageDirPath: ":imageDirPath",
        imageRefs: ":imageRefs",
      },
      isResult: true,
      params: {
        rowKey: "beat",
        compositeResult: true,
      },
      graph: beat_graph_data,
    },
    mergeResult: {
      isResult: true,
      agent: (namedInputs: { array: { imageFile: string; movieFile: string }[]; context: MulmoStudioContext }) => {
        const { array, context } = namedInputs;
        const { studio } = context;
        const beatIndexMap: Record<string, number> = {};
        array.forEach((update, index) => {
          const beat = studio.beats[index];
          studio.beats[index] = { ...beat, ...update };
          const id = studio.script.beats[index].id;
          if (id) {
            beatIndexMap[id] = index;
          }
        });
        studio.beats.forEach((studioBeat, index) => {
          const beat = studio.script.beats[index];
          if (beat.image?.type === "beat") {
            if (beat.image.id && beatIndexMap[beat.image.id] !== undefined) {
              studioBeat.imageFile = studio.beats[beatIndexMap[beat.image.id]].imageFile;
            } else if (index > 0) {
              studioBeat.imageFile = studio.beats[index - 1].imageFile;
            }
          }
        });
        return { studio };
      },
      inputs: {
        array: ":map.output",
        context: ":context",
      },
    },
    writeOutput: {
      // console: { before: true },
      agent: "fileWriteAgent",
      inputs: {
        file: ":outputStudioFilePath",
        text: ":mergeResult.studio.toJSON()",
      },
    },
  },
};

const googleAuth = async () => {
  try {
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    return accessToken.token!;
  } catch (error) {
    GraphAILogger.info("install gcloud and run 'gcloud auth application-default login'");
    throw error;
  }
};

const graphOption = async (context: MulmoStudioContext) => {
  const agentFilters = [
    {
      name: "fileCacheAgentFilter",
      agent: fileCacheAgentFilter,
      nodeIds: ["imageGenerator", "movieGenerator"],
    },
  ];

  const taskManager = new TaskManager(getConcurrency(context));

  const options: GraphOptions = {
    agentFilters,
    taskManager,
  };

  const imageAgentInfo = MulmoPresentationStyleMethods.getImageAgentInfo(context.presentationStyle);

  // We need to get google's auth token only if the google is the text2image provider.
  if (imageAgentInfo.provider === "google" || context.presentationStyle.movieParams?.provider === "google") {
    GraphAILogger.log("google was specified as text2image engine");
    const token = await googleAuth();
    options.config = {
      imageGoogleAgent: {
        projectId: process.env.GOOGLE_PROJECT_ID,
        token,
      },
      movieGoogleAgent: {
        projectId: process.env.GOOGLE_PROJECT_ID,
        token,
      },
    };
  }
  return options;
};

const prepareGenerateImages = async (context: MulmoStudioContext) => {
  const { studio, fileDirs } = context;
  const { outDirPath, imageDirPath } = fileDirs;
  mkdir(`${imageDirPath}/${studio.filename}`);

  const imageAgentInfo = MulmoPresentationStyleMethods.getImageAgentInfo(context.presentationStyle, context.dryRun);

  const imageRefs: Record<string, string> = {};
  const images = context.presentationStyle.imageParams?.images;
  if (images) {
    await Promise.all(
      Object.keys(images).map(async (key) => {
        const image = images[key];
        if (image.source.kind === "path") {
          imageRefs[key] = MulmoStudioContextMethods.resolveAssetPath(context, image.source.path);
        } else if (image.source.kind === "url") {
          const response = await fetch(image.source.url);
          if (!response.ok) {
            throw new Error(`Failed to download image: ${image.source.url}`);
          }
          const buffer = Buffer.from(await response.arrayBuffer());

          // Detect file extension from Content-Type header or URL
          const extension = (() => {
            const contentType = response.headers.get("content-type");
            if (contentType?.includes("jpeg") || contentType?.includes("jpg")) {
              return "jpg";
            } else if (contentType?.includes("png")) {
              return "png";
            } else {
              // Fall back to URL extension
              const urlExtension = image.source.url.split(".").pop()?.toLowerCase();
              if (urlExtension && ["jpg", "jpeg", "png"].includes(urlExtension)) {
                return urlExtension === "jpeg" ? "jpg" : urlExtension;
              }
              return "png"; // default
            }
          })();

          const imagePath = `${imageDirPath}/${context.studio.filename}/${key}.${extension}`;
          await fs.promises.writeFile(imagePath, buffer);
          imageRefs[key] = imagePath;
        }
      }),
    );
  }

  GraphAILogger.info(`text2image: provider=${imageAgentInfo.provider} model=${imageAgentInfo.imageParams.model}`);
  const injections: Record<string, Text2ImageAgentInfo | string | MulmoImageParams | MulmoStudioContext | { agent: string } | undefined> = {
    context,
    imageAgentInfo,
    movieAgentInfo: {
      agent: context.dryRun ? "mediaMockAgent" : "movieGoogleAgent",
    },
    outputStudioFilePath: getOutputStudioFilePath(outDirPath, studio.filename),
    imageDirPath,
    imageRefs,
  };
  return injections;
};

const getConcurrency = (context: MulmoStudioContext) => {
  const imageAgentInfo = MulmoPresentationStyleMethods.getImageAgentInfo(context.presentationStyle);
  if (imageAgentInfo.provider === "openai") {
    // NOTE: Here are the rate limits of OpenAI's text2image API (1token = 32x32 patch).
    // dall-e-3: 7,500 RPM、15 images per minute (4 images for max resolution)
    // gpt-image-1：3,000,000 TPM、150 images per minute
    return imageAgentInfo.imageParams.model === "dall-e-3" ? 4 : 16;
  }
  return 4;
};

const generateImages = async (context: MulmoStudioContext, callbacks?: CallbackFunction[]) => {
  const options = await graphOption(context);
  const injections = await prepareGenerateImages(context);
  const graph = new GraphAI(graph_data, { ...vanillaAgents, imageGoogleAgent, movieGoogleAgent, imageOpenaiAgent, mediaMockAgent, fileWriteAgent }, options);
  Object.keys(injections).forEach((key: string) => {
    graph.injectValue(key, injections[key]);
  });
  if (callbacks) {
    callbacks.forEach((callback) => {
      graph.registerCallback(callback);
    });
  }
  const res = await graph.run<{ output: MulmoStudioBeat[] }>();
  return res.mergeResult;
};

export const images = async (context: MulmoStudioContext, callbacks?: CallbackFunction[]) => {
  try {
    MulmoStudioContextMethods.setSessionState(context, "image", true);
    await generateImages(context, callbacks);
  } finally {
    MulmoStudioContextMethods.setSessionState(context, "image", false);
  }
};

export const generateBeatImage = async (index: number, context: MulmoStudioContext, callbacks?: CallbackFunction[]) => {
  const options = await graphOption(context);
  const injections = await prepareGenerateImages(context);
  const graph = new GraphAI(
    beat_graph_data,
    { ...vanillaAgents, imageGoogleAgent, movieGoogleAgent, imageOpenaiAgent, mediaMockAgent, fileWriteAgent },
    options,
  );
  Object.keys(injections).forEach((key: string) => {
    if ("outputStudioFilePath" !== key) {
      graph.injectValue(key, injections[key]);
    }
  });
  graph.injectValue("__mapIndex", index);
  graph.injectValue("beat", context.studio.script.beats[index]);
  if (callbacks) {
    callbacks.forEach((callback) => {
      graph.registerCallback(callback);
    });
  }
  await graph.run<{ output: MulmoStudioBeat[] }>();
};
