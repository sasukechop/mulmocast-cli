import { processSource, pathSource } from "./source.js";

export const imageType = "image";
export const process = processSource(imageType);
export const path = pathSource(imageType);
