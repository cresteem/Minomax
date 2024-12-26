import { readFileSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { cpus } from "node:os";
import { basename, dirname, extname, join, relative } from "node:path";
import { ImagePool } from "remige";
import { optimize } from "svgo";

import {
	AvifEncodeOptions,
	ConfigurationOptions,
	ImageWorkerOutputTypes,
	JpgEncodeOptions,
	SvgOptions,
	WebpEncodeOptions,
} from "../types";
import {
	batchProcess,
	currentTime,
	initProgressBar,
	logWriter,
	makeDirf,
	terminate,
} from "../utils";

class _SVGWorker {
	#svgOptions: SvgOptions;

	constructor({ svgOptions }: { svgOptions: SvgOptions }) {
		this.#svgOptions = svgOptions;
	}

	async #_svgBatchHandler(
		outputPromises: (() => Promise<void>)[],
	): Promise<void> {
		const batchSize: number = Math.floor((cpus().length * 80) / 100);

		await batchProcess({
			promisedProcs: outputPromises,
			batchSize: batchSize,
			context: "SVG Optimizer",
		});
	}

	async optimise(
		svgImagePaths: string[],
		destinationBasePath: string,
	): Promise<void> {
		const progressBar = initProgressBar({ context: "Optimizing SVG" });
		progressBar.start(svgImagePaths.length, 0);

		const outputPromises: (() => Promise<void>)[] = svgImagePaths.map(
			(svgPath: string) => () =>
				new Promise<void>((resolve, reject) => {
					readFile(svgPath, { encoding: "utf8" })
						.then((svgData: string) => {
							try {
								const outputSvgData: string =
									optimize(svgData, this.#svgOptions as any)?.data ||
									"Empty SVG Data";

								const outputPath: string = join(
									destinationBasePath,
									relative(process.cwd(), svgPath),
								);

								//Create directory Recursively
								makeDirf(dirname(outputPath));

								writeFile(outputPath, outputSvgData, {
									encoding: "utf8",
								})
									.then(() => {
										progressBar.increment();
										resolve();
									})
									.catch((error: Error) => {
										progressBar.increment();
										reject(
											`\nError writing svg file ${outputPath}\n` + error,
										);
									});
							} catch (err: any) {
								progressBar.increment();
								const logMessage: string = `${svgPath} => ${err}`;
								logWriter(logMessage);
								reject(err);
							}
						})
						.catch((error: Error) => {
							progressBar.increment();
							reject(`\nError Reading ${basename(svgPath)}\n` + error);
						});
				}),
		);

		try {
			await this.#_svgBatchHandler(outputPromises);
			progressBar.stop();
		} catch (err: any) {
			terminate({ reason: "Error while batch processing\n" + err });
		}
	}
}

class _RasterizedImageWorker {
	constructor() {}

	#_writeBinaryImage(
		encodeResult: Record<string, any>,
		filePath: string,
		destinationBasePath: string,
	): Promise<void> {
		const fileType: string = Object.keys(encodeResult.encodedWith)[0];
		const extension: string = encodeResult.encodedWith[fileType].extension;

		const outputPath: string = join(
			destinationBasePath,
			dirname(relative(process.cwd(), filePath)),
			`${basename(filePath, extname(filePath))}.${extension}`,
		);

		//make dir
		makeDirf(dirname(outputPath));

		const outputImage: BinaryType =
			encodeResult.encodedWith[fileType].binary;

		return new Promise((resolve, reject) => {
			writeFile(outputPath, outputImage, {
				encoding: "binary",
			})
				.then(() => {
					/* remove stale (old output dir)*/
					/* check if the stale and op file in same directory */
					if (
						relative(process.cwd(), dirname(filePath)) ===
						relative(process.cwd(), dirname(outputPath))
					) {
						/* Remove Stale if extension is changing */
						if (extname(filePath) !== extname(outputPath)) {
							rm(filePath, { recursive: true, force: true })
								.then(resolve)
								.catch(console.warn);
						}
					}

					resolve();
				})
				.catch((error: Error) => {
					reject(`Error writing image output: ${outputPath}\n` + error);
				});
		});
	}

	encode(
		imagePaths: string[],
		encodeOptions:
			| JpgEncodeOptions
			| AvifEncodeOptions
			| WebpEncodeOptions,
		destinationBasePath: string,
	): Promise<void> {
		const progressBar = initProgressBar({ context: "Encoding Images" });
		progressBar.start(imagePaths.length, 0);

		//number of concurrent process.
		/* 70 percentage of core count If there is no cpu allocation in Settings */
		const threadCount: number = Math.floor((70 * cpus().length) / 100);

		const pool = new ImagePool(threadCount);

		/* Ingest images in pool */
		const imagesRecords: {
			ingestedImage: Record<string, any>;
			filePath: string;
		}[] = imagePaths.map((filePath: string) => {
			return {
				ingestedImage: pool.ingestImage(readFileSync(filePath)),
				filePath: filePath,
			};
		});

		/* Encode ingested images and save it */
		const outputPromises: Promise<void>[] = imagesRecords.map(
			(imagesRecord): Promise<void> =>
				new Promise((resolve, reject) => {
					let { ingestedImage, filePath } = imagesRecord;

					ingestedImage
						.encode(encodeOptions)
						.then(() => {
							this.#_writeBinaryImage(
								ingestedImage,
								filePath,
								destinationBasePath,
							)
								.then(() => {
									progressBar.increment();
									resolve();
								})
								.catch((err: Error) => {
									progressBar.increment();
									reject("Error writing binary image data\n " + err);
								});
						})
						.catch((err: Error) => {
							progressBar.increment();
							reject("Error encoding images\n" + err);
						});
				}),
		);

		return new Promise((resolve, reject) => {
			Promise.all(outputPromises)
				.then(() => {
					//closing image pool
					pool
						.close()
						.then(() => {
							resolve();
						})
						.catch((err: Error) => {
							console.log("Failed to closing pool\n", err);
						});
					progressBar.stop();
				})
				.catch((err: Error) => {
					progressBar.stop();
					//closing image pool
					pool.close().catch((err: Error) => {
						console.log("Failed to closing pool\n", err);
					});
					reject(err);
				});
		});
	}
}

export default class ImageWorker {
	#jpgEncodeOptions: JpgEncodeOptions;
	#webpEncodeOptions: WebpEncodeOptions;
	#avifEncodeOptions: AvifEncodeOptions;
	#svgOptions: SvgOptions;

	#destPath: string;

	constructor(configurations: ConfigurationOptions) {
		const {
			encodeOptions: {
				jpgEncodeOptions,
				webpEncodeOptions,
				avifEncodeOptions,
				svgOptions,
			},
			destPath,
		} = configurations;

		this.#jpgEncodeOptions = jpgEncodeOptions;
		this.#webpEncodeOptions = webpEncodeOptions;
		this.#avifEncodeOptions = avifEncodeOptions;
		this.#svgOptions = svgOptions;

		this.#destPath = destPath;
	}

	async encode(
		imagePaths: string[],
		targetFormat: ImageWorkerOutputTypes,
		destinationBasePath: string = this.#destPath,
	): Promise<void> {
		/* dumpRunTimeData({ data: imagePaths, context: "Image Paths" }); */

		imagePaths = Array.from(new Set(imagePaths)); // keep unique image paths

		process.on("SIGINT", () => {
			terminate({
				reason: "User interrupted encoding process. Shutting down....",
			});
		});

		console.log(`\n[${currentTime()}] +++> ⏰ Image Encoding Started\n`);

		console.log(
			`Number of ${
				targetFormat === "svg" ? "SVG" : "Rasterized"
			} images: ${imagePaths.length}\n`,
		);

		if (targetFormat === "svg") {
			try {
				await new _SVGWorker({
					svgOptions: this.#svgOptions,
				}).optimise(imagePaths, destinationBasePath);

				console.log(
					`\n[${currentTime()}] ===> ✅ Images are optimised with SVG format.`,
				);
			} catch (err) {
				terminate({ reason: "❌ SVG optimization failed" + err });
			}
		} else {
			const encodeOptions:
				| JpgEncodeOptions
				| AvifEncodeOptions
				| WebpEncodeOptions
				| false =
				targetFormat === "avif"
					? this.#avifEncodeOptions
					: targetFormat === "webp"
					? this.#webpEncodeOptions
					: targetFormat === "jpg"
					? this.#jpgEncodeOptions
					: false;

			if (!encodeOptions) {
				terminate({
					reason: "❌ Provided image extension is unsupported",
				});
			}

			try {
				//encoding for jpg/avif/webp
				await new _RasterizedImageWorker().encode(
					imagePaths,
					encodeOptions as any,
					destinationBasePath,
				);

				console.log(
					`\n[${currentTime()}] ===> ✅ Images are optimised with ${targetFormat.toUpperCase()} format.`,
				);
			} catch (error) {
				terminate({
					reason:
						"❌ Something wrong occurred while encoding images\n" + error,
				});
			}
		}
	}
}
