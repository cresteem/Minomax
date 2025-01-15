import { encode as encodeVideo } from "handstop";
import {
	basename,
	dirname,
	extname,
	join,
	relative,
	resolve,
	sep,
} from "node:path";

import ffmpegIns from "@ffmpeg-installer/ffmpeg";
import ffprobeIns from "@ffprobe-installer/ffprobe";
import ffmpeg from "fluent-ffmpeg";

import { CheerioAPI, load } from "cheerio/slim";
import {
	BatchSizeType,
	CodecType,
	ImageWorkerOutputTypes,
} from "../../lib/types";
import {
	batchProcess,
	compressionRatioLog,
	currentTime,
	getFreeMemBatchSize,
	initProgressBar,
	makeDirf,
	terminate,
} from "../utils";

export default class VideoWorker {
	#batchSizes: BatchSizeType;

	constructor(batchSizes: BatchSizeType) {
		ffmpeg.setFfmpegPath(ffmpegIns.path);
		ffmpeg.setFfprobePath(ffprobeIns.path);

		this.#batchSizes = batchSizes;
	}

	videoThumbnailLinker({
		htmlFilePath,
		htmlContent,
		variableImgFormat,
		videoCodec,
	}: {
		htmlFilePath: string;
		htmlContent: string;
		variableImgFormat: ImageWorkerOutputTypes | false;
		videoCodec: CodecType | false;
	}): { metas: Record<string, string>; updatedContent: string } {
		const videoMetas: Record<string, string> = {};

		// Load the HTML content into Cheerio
		const htmlTree: CheerioAPI = load(htmlContent);

		//video thumbnail includer
		const videoTags: Element[] | any[] = htmlTree("video") as any;

		for (const videoTag of videoTags) {
			const shallowVideoUrl: string | undefined =
				htmlTree(videoTag).attr("src");

			const linkInSourceTag = htmlTree(videoTag)
				.find("source:first-child")
				.attr("src");
			let videoUrl: string = shallowVideoUrl
				? shallowVideoUrl
				: linkInSourceTag || "";

			const newSrc = join(
				dirname(videoUrl),
				`${basename(videoUrl, extname(videoUrl))}${
					videoCodec
						? ["mx265", "mav1"].includes(videoCodec)
							? ".mp4"
							: ".webm"
						: extname(videoUrl)
				}`,
			);

			if (shallowVideoUrl) {
				htmlTree(videoTag).attr("src", newSrc);
			} else if (linkInSourceTag) {
				htmlTree(videoTag).find("source:first-child").attr("src", newSrc);
			}

			if (!videoUrl) {
				continue;
			} else {
				videoUrl = resolve(join(dirname(htmlFilePath), videoUrl));
				/* if (!existsSync(videoUrl)) {
					continue;
				} */
			}

			const thumbnailUrlWithNoExt: string = join(
				dirname(videoUrl),
				"thumbnails",
				basename(videoUrl, extname(videoUrl)),
			);

			videoMetas[videoUrl] = resolve(thumbnailUrlWithNoExt.concat(".jpg"));

			const relativeSrcPath: string = relative(
				dirname(htmlFilePath),
				thumbnailUrlWithNoExt.concat(
					variableImgFormat ? "." + variableImgFormat : ".jpg",
				),
			).replaceAll(sep, "/");

			htmlTree(videoTag).attr("poster", relativeSrcPath);
		}

		return {
			metas: videoMetas,
			updatedContent: htmlTree.root().toString(),
		};
	}

	thumbnailGenerator({
		videoPath,
		basepath,
		seekPercentage = 15, //1-100
	}: {
		videoPath: string;
		basepath: string;
		seekPercentage: number;
	}): Promise<void> {
		const outputFramePath: string = join(
			basepath,
			relative(process.cwd(), dirname(videoPath)),
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

				const durationInSeconds: number = metadata?.format?.duration || 0;

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
						/* console.log(
							`Video thumbnail saved in ${join(
								outputFramePath,
								filename,
							)}`,
						); */
						resolve();
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
		basepath: string,
	) {
		videoPaths = Array.from(new Set(videoPaths)); //keep unique videos path

		const videoEncodeBatchSize: number =
			getFreeMemBatchSize({
				memPerProc: 1500,
				cPerBatchSize: this.#batchSizes.cPer,
			}) || 1;

		/* dumpRunTimeData({
			data: videoPaths,
			context: "Video Files",
		}); */

		try {
			console.log(
				`\n[${currentTime()}] +++> ⏰ Video Encoding started.\n`,
			);

			console.log(`Number of videos in queue: ${videoPaths.length}`);
			console.log(
				`Number of encodes at a time: ${Math.min(
					videoEncodeBatchSize,
					videoPaths.length,
				)}\n`,
			);

			const progressBar = initProgressBar({ context: "Encoding Videos" });
			progressBar.start(videoPaths.length, 0);

			const encodePromises = videoPaths.map(
				(videoPath) => () =>
					new Promise<void>((resolve, reject) => {
						const outputPath = join(
							basepath,
							relative(
								process.cwd(),
								join(
									dirname(videoPath),
									`${basename(videoPath, extname(videoPath))}.${
										["mx265", "mav1"].includes(codecType) ? "mp4" : "webm"
									}`,
								),
							),
						);
						encodeVideo(videoPath, outputPath, codecType, encodeLevel)
							.then(() => {
								progressBar.increment();
								resolve();
							})
							.catch((err) => {
								progressBar.increment();
								reject("Error while encoding video.\n" + err);
							});
					}),
			);

			await batchProcess({
				promisedProcs: encodePromises,
				batchSize: videoEncodeBatchSize,
				context: "Video Encoding",
			});
			progressBar.stop();

			console.log(`\n[${currentTime()}] ===> ✅ Videos were encoded.`);
		} catch (error: any) {
			terminate({
				reason:
					"Minomax: Unexpected error while encoding videos\n" +
					"Minomax process halted\n" +
					error,
			});
		}

		await compressionRatioLog(
			videoPaths,
			videoPaths.map((videoPath) =>
				join(
					basepath,
					relative(
						process.cwd(),
						join(
							dirname(videoPath),
							`${basename(videoPath, extname(videoPath))}.${
								["mx265", "mav1"].includes(codecType) ? "mp4" : "webm"
							}`,
						),
					),
				),
			),
			"Video",
		);
	}
}
