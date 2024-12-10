import { encodeAll } from "handstop";
import { freemem } from "node:os";
import { basename, dirname, extname, join, relative } from "node:path";

import ffmpegIns from "@ffmpeg-installer/ffmpeg";
import ffprobeIns from "@ffprobe-installer/ffprobe";
import ffmpeg from "fluent-ffmpeg";

import { ConfigurationOptions } from "../../lib/types";
import { currentTime, makeDirf } from "../utils";

export default class VideoWorker {
	#destPath: string;

	constructor(configuration: ConfigurationOptions) {
		ffmpeg.setFfmpegPath(ffmpegIns.path);
		ffmpeg.setFfprobePath(ffprobeIns.path);

		this.#destPath = configuration.destPath;
	}

	#_thumbnailGenerator(
		videoPath: string,
		seekPercentage: number,
		basepath: string,
	): Promise<string> {
		const outputFramePath: string = join(
			basepath,
			relative(".", dirname(videoPath)),
			"thumbnails",
		);
		const filename: string =
			basename(videoPath, extname(videoPath)) + ".jpg";

		//create dir if not exist
		makeDirf(outputFramePath);

		return new Promise((resolve, reject) => {
			// Get video duration
			ffmpeg.ffprobe(videoPath, (err: Error, metadata) => {
				if (err) {
					reject("Error while getting video duration:" + err);
				}

				const durationInSeconds: number = metadata.format?.duration ?? 0;

				// Calculate seek time based on percentage
				const seekTime: number =
					(seekPercentage / 100) * durationInSeconds;

				// Create the ffmpeg command
				ffmpeg(videoPath)
					.screenshot({
						count: 1,
						folder: outputFramePath,
						filename: filename,
						timestamps: [seekTime],
					})
					.on("end", () => {
						resolve(
							`Video thumbnail saved in ${join(
								outputFramePath,
								filename,
							)}`,
						);
					})
					.on("error", (err: Error) => {
						reject("Error while saving video thumbnail:" + err);
					});
			});
		});
	}

	async encode(
		videoPaths: string[],
		codecType: "wav1" | "mav1" | "mx265" = "wav1",
		encodeLevel: 1 | 2 | 3 = 1,
		thumbnailSeekPercent: number = 15, //1-100
		basepath: string = this.#destPath,
	) {
		const availmem: number = Math.floor(freemem() / 1024 / 1024);

		const batchSize: number = Math.floor(availmem / 1500) || 1;

		try {
			console.log(`\n[${currentTime()}] +++> Video Encoding started.`);

			console.log(`Number of videos in queue: ${videoPaths.length}`);
			console.log(`Number of encodes at a time: ${batchSize}`);

			const { success } = await encodeAll(
				videoPaths,
				basepath,
				codecType,
				encodeLevel,
				batchSize,
			);

			if (!success) {
				throw new Error("Passive error in shell");
			}

			console.log(`[${currentTime()}] ===> Videos were encoded.`);

			console.log(
				`\n[${currentTime()}] +++> Thumbnail generation started.`,
			);

			for (const videoPath of videoPaths) {
				await this.#_thumbnailGenerator(
					videoPath,
					thumbnailSeekPercent,
					basepath,
				);
			}

			console.log(`[${currentTime()}] ===> Thumbnails were generated.`);
		} catch (error: any) {
			console.log(
				"Minomax: Unexpected error while encoding videos\n",
				"Minomax process halted\n",
				error,
			);
			process.exit(1);
		}
	}
}
