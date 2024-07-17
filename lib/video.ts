import { encodeAll } from "handstop";
import { freemem } from "os";
import { basename, dirname, extname, join, relative } from "path";
import { currentTime, makeDirf } from "./utils";

import ffmpegIns from "@ffmpeg-installer/ffmpeg";
import ffprobeIns from "@ffprobe-installer/ffprobe";
import ffmpeg from "fluent-ffmpeg";
import configurations from "../configLoader";

ffmpeg.setFfmpegPath(ffmpegIns.path);
ffmpeg.setFfprobePath(ffprobeIns.path);

function _thumbnailGenerator(
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
				reject("Error while getting video duration:" + err.message);
			}

			const durationInSeconds: number = metadata.format?.duration ?? 0;

			// Calculate seek time based on percentage
			const seekTime: number = (seekPercentage / 100) * durationInSeconds;

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
						`Screenshot saved in ${join(outputFramePath, filename)}`,
					);
				})
				.on("error", (err: Error) => {
					reject("Error while taking screenshot:" + err.message);
				});
		});
	});
}

export default async function videoWorker(
	videoPaths: string[],
	codecType: "wav1" | "mav1" | "mx265" = "wav1",
	encodeLevel: 1 | 2 | 3 = 1,
	thumbnailSeekPercent: number = 15, //1-100
	basepath: string = configurations.destPath,
) {
	const availmem: number = Math.floor(freemem() / 1024 / 1024);

	let batchSize: number = Math.floor(availmem / 1500);
	batchSize = batchSize ? batchSize : 1;

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
			console.log("Passive error while encoding");
		}

		console.log(`[${currentTime()}] ===> Videos were encoded.`);

		console.log(`\n[${currentTime()}] +++> Thumbnail generation started.`);

		for (const videoPath of videoPaths) {
			await _thumbnailGenerator(videoPath, thumbnailSeekPercent, basepath);
		}

		console.log(`[${currentTime()}] ===> Thumbnails were generated.`);
	} catch (error: any) {
		console.log(error);
		process.exit(1);
	}
}
