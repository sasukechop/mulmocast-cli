import ffmpeg from "fluent-ffmpeg";

export const extractImageFromMovie = (movieFile: string, imagePath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    ffmpeg(movieFile)
      .outputOptions(["-frames:v 1"])
      .output(imagePath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
};
