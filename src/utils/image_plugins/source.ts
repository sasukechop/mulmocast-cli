import fs from "fs";
import { GraphAILogger } from "graphai";
import { ImageProcessorParams } from "../../types/index.js";
import { MulmoMediaSourceMethods } from "../../methods/mulmo_media_source.js";

type ImageType = "image" | "movie";

function fixExtention(path: string, imageType: ImageType) {
  if (imageType === "movie") {
    return path.replace(/\.png$/, ".mov");
  }
  return path;
}

export const processSource = (imageType: ImageType) => {
  return async (params: ImageProcessorParams) => {
    const { beat, context } = params;
    if (!beat?.image || beat.image.type !== imageType) return;

    if (beat.image.source.kind === "url") {
      const response = await fetch(beat.image.source.url);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${beat.image.source.url}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());

      // Detect file extension from Content-Type header or URL
      const imagePath = fixExtention(params.imagePath, beat.image.type);
      await fs.promises.writeFile(imagePath, buffer);
      return imagePath;
    }
    const path = MulmoMediaSourceMethods.resolve(beat.image.source, context);
    if (path) {
      return path;
    }
    GraphAILogger.error(`Image Plugin unknown ${imageType} source type:`, beat.image);
    throw new Error(`ERROR: unknown ${imageType} source type`);
  };
};

export const pathSource = (__: ImageType) => {
  return (params: ImageProcessorParams) => {
    const { beat, context } = params;
    if (beat.image?.type == "image" || beat.image?.type == "movie") {
      if (beat.image.source?.kind === "url") {
        return fixExtention(params.imagePath, beat.image.type);
      }
      const path = MulmoMediaSourceMethods.resolve(beat.image.source, context);
      if (path) {
        return path;
      }
      return undefined;
    }
  };
};
