import { AgentFunction, AgentFunctionInfo } from "graphai";
import { extractImageFromMovie } from "../utils/movie.js";

export const movieToImageAgent: AgentFunction = async ({ namedInputs }) => {
  const { movieFile, imagePath } = namedInputs as { movieFile: string; imagePath: string };
  await extractImageFromMovie(movieFile, imagePath);
  return { imagePath };
};

const movieToImageAgentInfo: AgentFunctionInfo = {
  name: "movieToImageAgent",
  agent: movieToImageAgent,
  mock: movieToImageAgent,
  samples: [],
  description: "Extract an image from a movie file",
  category: ["movie"],
  author: "Receptron Team",
  repository: "https://github.com/receptron/mulmocast-cli/",
  license: "MIT",
  environmentVariables: [],
};

export default movieToImageAgentInfo;
