import "dotenv/config";

import { GraphAI, TaskManager, GraphAILogger } from "graphai";
import type { GraphData } from "graphai";
import * as agents from "@graphai/vanilla";
import { fileWriteAgent } from "@graphai/vanilla_node_agents";

import { ttsNijivoiceAgent, ttsOpenaiAgent, ttsGoogleAgent, ttsElevenlabsAgent, addBGMAgent, combineAudioFilesAgent, mediaMockAgent } from "../agents/index.js";

import { MulmoStudioContext, MulmoBeat, MulmoStudioBeat, MulmoStudioMultiLingualData, PublicAPIArgs, text2SpeechProviderSchema } from "../types/index.js";

import { fileCacheAgentFilter, nijovoiceTextAgentFilter } from "../utils/filters.js";
import { getAudioArtifactFilePath, getAudioFilePath, getOutputStudioFilePath, resolveDirPath, defaultBGMPath, mkdir, writingMessage } from "../utils/file.js";
import { localizedText, settings2GraphAIConfig } from "../utils/utils.js";
import { text2hash } from "../utils/utils_node.js";
import { provider2TTSAgent } from "../utils/provider2agent.js";

import { MulmoPresentationStyleMethods } from "../methods/index.js";
import { MulmoStudioContextMethods } from "../methods/mulmo_studio_context.js";
import { MulmoMediaSourceMethods } from "../methods/mulmo_media_source.js";

const vanillaAgents = agents.default ?? agents;

const getAudioPath = (context: MulmoStudioContext, beat: MulmoBeat, audioFile: string): string | undefined => {
  if (beat.audio?.type === "audio") {
    const path = MulmoMediaSourceMethods.resolve(beat.audio.source, context);
    if (path) {
      return path;
    }
    throw new Error("Invalid audio source");
  }
  if (beat.text === undefined || beat.text === "" || context.studio.script.audioParams.suppressSpeech) {
    return undefined; // It indicates that the audio is not needed.
  }
  return audioFile;
};

const getAudioParam = (context: MulmoStudioContext, beat: MulmoBeat, lang?: string) => {
  const speaker = MulmoPresentationStyleMethods.getSpeaker(context, beat, lang);
  const speechOptions = { ...speaker.speechOptions, ...beat.speechOptions };
  const provider = text2SpeechProviderSchema.parse(speaker.provider) as keyof typeof provider2TTSAgent;
  return { voiceId: speaker.voiceId, provider, speechOptions, model: speaker.model };
};

export const getBeatAudioPath = (text: string, context: MulmoStudioContext, beat: MulmoBeat, lang?: string) => {
  const audioDirPath = MulmoStudioContextMethods.getAudioDirPath(context);
  const { voiceId, provider, speechOptions, model } = getAudioParam(context, beat, lang);
  const hash_string = [text, voiceId, speechOptions?.instruction ?? "", speechOptions?.speed ?? 1.0, provider, model ?? ""].join(":");
  GraphAILogger.log(`getBeatAudioPath [${hash_string}]`);
  const audioFileName = `${context.studio.filename}_${text2hash(hash_string)}`;
  const audioFile = getAudioFilePath(audioDirPath, context.studio.filename, audioFileName, lang);
  return getAudioPath(context, beat, audioFile);
};

export const listLocalizedAudioPaths = (context: MulmoStudioContext) => {
  const lang = context.lang ?? context.studio.script.lang;
  return context.studio.script.beats.map((beat, index) => {
    const multiLingual = context.multiLingual[index];
    const text = localizedText(beat, multiLingual, lang);
    return getBeatAudioPath(text, context, beat, lang);
  });
};

const preprocessorAgent = (namedInputs: {
  beat: MulmoBeat;
  studioBeat: MulmoStudioBeat;
  multiLingual: MulmoStudioMultiLingualData;
  context: MulmoStudioContext;
  lang: string;
}) => {
  const { beat, studioBeat, multiLingual, context, lang } = namedInputs;
  // const { lang } = context;
  const text = localizedText(beat, multiLingual, lang);
  const { voiceId, provider, speechOptions, model } = getAudioParam(context, beat, lang);
  const audioPath = getBeatAudioPath(text, context, beat, lang);
  studioBeat.audioFile = audioPath; // TODO: Passing by reference is difficult to maintain, so pass it using graphai inputs
  const needsTTS = !beat.audio && audioPath !== undefined;

  return {
    ttsAgent: provider2TTSAgent[provider].agentName,
    text,
    voiceId,
    speechOptions,
    model,
    provider,
    lang,
    audioPath,
    studioBeat,
    needsTTS,
  };
};

const graph_tts: GraphData = {
  nodes: {
    beat: {},
    studioBeat: {},
    multiLingual: {},
    context: {},
    __mapIndex: {},
    lang: {},
    preprocessor: {
      agent: preprocessorAgent,
      inputs: {
        beat: ":beat",
        studioBeat: ":studioBeat",
        multiLingual: ":multiLingual",
        context: ":context",
        lang: ":lang",
      },
    },
    tts: {
      if: ":preprocessor.needsTTS",
      agent: ":preprocessor.ttsAgent",
      inputs: {
        media: "audio",
        text: ":preprocessor.text",
        provider: ":preprocessor.provider",
        lang: ":preprocessor.lang",
        cache: {
          force: [":context.force"],
          file: ":preprocessor.audioPath",
          index: ":__mapIndex",
          id: ":beat.id",
          mulmoContext: ":context",
          sessionType: "audio",
        },
        params: {
          voice: ":preprocessor.voiceId",
          speed: ":preprocessor.speechOptions.speed",
          instructions: ":preprocessor.speechOptions.instruction",
          model: ":preprocessor.model",
        },
      },
    },
  },
};

const graph_tts_map: GraphData = {
  version: 0.5,
  concurrency: 8,
  nodes: {
    beat: {},
    studioBeat: {},
    multiLingual: {},
    context: {},
    __mapIndex: {},
    langs: {},
    map: {
      agent: "mapAgent",
      inputs: {
        rows: ":langs",
        beat: ":beat",
        studioBeat: ":studioBeat",
        multiLingual: ":multiLingual",
        context: ":context",
        __mapIndex: ":__mapIndex",
      },
      params: {
        rowKey: "lang",
      },
      graph: graph_tts,
    },
  },
};
export const audio_graph_data: GraphData = {
  version: 0.5,
  concurrency: 8,
  nodes: {
    context: {},
    audioArtifactFilePath: {},
    audioCombinedFilePath: {},
    outputStudioFilePath: {},
    musicFile: {},
    map: {
      agent: "mapAgent",
      inputs: {
        rows: ":context.studio.script.beats",
        studioBeat: ":context.studio.beats",
        multiLingual: ":context.multiLingual",
        context: ":context",
        lang: ":context.lang",
      },
      params: {
        rowKey: "beat",
        expandKeys: ["studioBeat", "multiLingual"],
      },
      graph: graph_tts,
    },
    combineFiles: {
      agent: "combineAudioFilesAgent",
      inputs: {
        onComplete: ":map",
        context: ":context",
        combinedFileName: ":audioCombinedFilePath",
      },
      isResult: true,
    },
    fileWrite: {
      agent: "fileWriteAgent",
      inputs: {
        file: ":outputStudioFilePath",
        text: ":combineFiles.studio.toJSON()",
      },
    },
    addBGM: {
      agent: "addBGMAgent",
      inputs: {
        wait: ":combineFiles",
        voiceFile: ":audioCombinedFilePath",
        outputFile: ":audioArtifactFilePath",
        context: ":context",
        params: {
          musicFile: ":musicFile",
        },
      },
    },
  },
};

const agentFilters = [
  {
    name: "fileCacheAgentFilter",
    agent: fileCacheAgentFilter,
    nodeIds: ["tts"],
  },
  {
    name: "nijovoiceTextAgentFilter",
    agent: nijovoiceTextAgentFilter,
    nodeIds: ["tts"],
  },
];

const getConcurrency = (context: MulmoStudioContext) => {
  // Check if any speaker uses nijivoice or elevenlabs (providers that require concurrency = 1)
  const hasLimitedConcurrencyProvider = Object.values(context.presentationStyle.speechParams.speakers).some((speaker) => {
    const provider = text2SpeechProviderSchema.parse(speaker.provider) as keyof typeof provider2TTSAgent;
    return provider2TTSAgent[provider].hasLimitedConcurrency;
  });
  return hasLimitedConcurrencyProvider ? 1 : 8;
};

const audioAgents = {
  ...vanillaAgents,
  fileWriteAgent,
  ttsOpenaiAgent,
  ttsNijivoiceAgent,
  ttsGoogleAgent,
  ttsElevenlabsAgent,
  mediaMockAgent,
  addBGMAgent,
  combineAudioFilesAgent,
};

export const generateBeatAudio = async (index: number, context: MulmoStudioContext, args?: PublicAPIArgs & { langs: string[] }) => {
  const { settings, callbacks, langs } = args ?? {};
  try {
    MulmoStudioContextMethods.setSessionState(context, "audio", true);
    const fileName = MulmoStudioContextMethods.getFileName(context);
    const audioDirPath = MulmoStudioContextMethods.getAudioDirPath(context);
    const outDirPath = MulmoStudioContextMethods.getOutDirPath(context);
    const audioSegmentDirPath = resolveDirPath(audioDirPath, fileName);

    mkdir(outDirPath);
    mkdir(audioSegmentDirPath);

    const config = settings2GraphAIConfig(settings);
    const taskManager = new TaskManager(getConcurrency(context));
    const graph = new GraphAI(langs ? graph_tts_map : graph_tts, audioAgents, { agentFilters, taskManager, config });
    graph.injectValue("__mapIndex", index);
    graph.injectValue("beat", context.studio.script.beats[index]);
    graph.injectValue("studioBeat", context.studio.beats[index]);
    graph.injectValue("multiLingual", context.multiLingual[index]);
    graph.injectValue("context", context);

    if (langs) {
      graph.injectValue("langs", langs);
    } else {
      graph.injectValue("lang", context.lang);
    }
    if (callbacks) {
      callbacks.forEach((callback) => {
        graph.registerCallback(callback);
      });
    }
    await graph.run();
  } finally {
    MulmoStudioContextMethods.setSessionState(context, "audio", false);
  }
};

export const audio = async (context: MulmoStudioContext, args?: PublicAPIArgs) => {
  const { settings, callbacks } = args ?? {};
  try {
    MulmoStudioContextMethods.setSessionState(context, "audio", true);
    const fileName = MulmoStudioContextMethods.getFileName(context);
    const audioDirPath = MulmoStudioContextMethods.getAudioDirPath(context);
    const outDirPath = MulmoStudioContextMethods.getOutDirPath(context);
    const audioArtifactFilePath = getAudioArtifactFilePath(context);
    const audioSegmentDirPath = resolveDirPath(audioDirPath, fileName);
    const audioCombinedFilePath = getAudioFilePath(audioDirPath, fileName, fileName, context.lang);
    const outputStudioFilePath = getOutputStudioFilePath(outDirPath, fileName);

    mkdir(outDirPath);
    mkdir(audioSegmentDirPath);

    const config = settings2GraphAIConfig(settings, process.env);
    const taskManager = new TaskManager(getConcurrency(context));
    const graph = new GraphAI(audio_graph_data, audioAgents, { agentFilters, taskManager, config });
    graph.injectValue("context", context);
    graph.injectValue("audioArtifactFilePath", audioArtifactFilePath);
    graph.injectValue("audioCombinedFilePath", audioCombinedFilePath);
    graph.injectValue("outputStudioFilePath", outputStudioFilePath);
    graph.injectValue(
      "musicFile",
      MulmoMediaSourceMethods.resolve(context.presentationStyle.audioParams.bgm, context) ?? process.env.PATH_BGM ?? defaultBGMPath(),
    );

    if (callbacks) {
      callbacks.forEach((callback) => {
        graph.registerCallback(callback);
      });
    }
    const result = await graph.run();
    writingMessage(audioCombinedFilePath);
    MulmoStudioContextMethods.setSessionState(context, "audio", false);
    writingMessage(audioArtifactFilePath);
    return result.combineFiles as MulmoStudioContext;
  } catch (__error) {
    MulmoStudioContextMethods.setSessionState(context, "audio", false);
    throw __error;
  }
};
