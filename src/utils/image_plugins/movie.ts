import { processSource, pathSource } from "./source.js";

export const imageType = "movie";
export const process = processSource(imageType);
export const path = pathSource(imageType);
