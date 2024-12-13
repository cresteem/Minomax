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
import { currentTime, logWriter, makeDirf } from "../utils";

class _SVGWorker {
	#cpuAllocation: number;
	#svgOptions: SvgOptions;

	constructor({
		cpuAllocation,
		svgOptions,
	}: {
		cpuAllocation: number;
		svgOptions: SvgOptions;
	}) {
		this.#svgOptions = svgOptions;
		this.#cpuAllocation = cpuAllocation;
	}

	async #_svgBatchHandler(
		outputPromises: (() => Promise<void>)[],
	): Promise<void> {
		const promiseBatches: (() => Promise<void>)[][] = [];

		const batchSize: number = this.#cpuAllocation * 4;

		for (let i = 0; i < outputPromises.length; i += batchSize) {
			promiseBatches.push(outputPromises.slice(i, i + batchSize));
		}

		for (const batch of promiseBatches) {
			const activatedBatch: Promise<void>[] = batch.map((func) => func());

			await Promise.allSettled(activatedBatch);
		}
	}

	async optimise(
		svgImagePaths: string[],
		destinationBasePath: string,
	): Promise<void> {
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
										resolve();
									})
									.catch((error: Error) => {
										reject(
											`\nError writing svg file ${outputPath}\n` + error,
										);
									});
							} catch (err: any) {
								const logMessage: string = `${svgPath} => ${err}`;
								logWriter(logMessage);
								reject();
							}
						})
						.catch((error: Error) => {
							reject(`\nError: ${basename(svgPath)}\n` + error);
						});
				}),
		);

		try {
			await this.#_svgBatchHandler(outputPromises);
		} catch (err: any) {
			console.log("Error while batch processing\n", err);
			process.exit(1);
		}
	}
}

class _RasterizedImageWorker {
	#cpuAllocation: number;

	constructor({ cpuAllocation }: { cpuAllocation: number }) {
		this.#cpuAllocation = cpuAllocation;
	}

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
		encodeOptions: Record<string, any>,
		destinationBasePath: string,
	): Promise<void> {
		//number of concurrent process.
		/* 70 percentage of core count If there is no cpu allocation in Settings */
		const threadCount: number =
			this.#cpuAllocation || Math.floor((70 * cpus().length) / 100);

		const pool = new ImagePool(threadCount);

		/* Ingest images in pool */
		const imagesRecords: {
			encodeResult: Record<string, any>;
			filePath: string;
		}[] = imagePaths.map((filePath: string) => {
			return {
				encodeResult: pool.ingestImage(readFileSync(filePath)),
				filePath: filePath,
			};
		});

		/* Encode ingested images and save it */
		const outputPromises: Promise<void>[] = imagesRecords.map(
			(imagesRecord): Promise<void> =>
				new Promise((resolve, reject) => {
					let { encodeResult, filePath } = imagesRecord;

					encodeResult
						.encode(encodeOptions)
						.then(() => {
							this.#_writeBinaryImage(
								encodeResult,
								filePath,
								destinationBasePath,
							)
								.then(() => {
									resolve();
								})
								.catch((err: Error) => {
									reject("Error writing binary image data\n " + err);
								});
						})
						.catch((err: Error) => {
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
				})
				.catch((err: Error) => {
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

	#cpuAllocation: number;
	#destPath: string;

	constructor(configurations: ConfigurationOptions) {
		const {
			encodeOptions: {
				jpgEncodeOptions,
				webpEncodeOptions,
				avifEncodeOptions,
				svgOptions,
				cpuAllocation,
			},
			destPath,
		} = configurations;

		this.#jpgEncodeOptions = jpgEncodeOptions;
		this.#webpEncodeOptions = webpEncodeOptions;
		this.#avifEncodeOptions = avifEncodeOptions;
		this.#svgOptions = svgOptions;

		this.#cpuAllocation = cpuAllocation;
		this.#destPath = destPath;
	}

	async encode(
		imagePaths: string[],
		targetFormat: ImageWorkerOutputTypes,
		destinationBasePath: string = this.#destPath,
	): Promise<void> {
		process.on("SIGINT", () => {
			console.log("User interrupted encoding process. Shutting down....");
			process.exit(1);
		});

		console.log(`Number of images: ${imagePaths.length}`);

		console.log(`[${currentTime()}] +++> Image Encoding Started`);

		if (targetFormat === "svg") {
			try {
				await new _SVGWorker({
					cpuAllocation: this.#cpuAllocation,
					svgOptions: this.#svgOptions,
				}).optimise(imagePaths, destinationBasePath);

				console.log(
					`[${currentTime()}] ===> Images are optimised with SVG format.`,
				);
			} catch (err) {
				console.log("SVG optimization failed", err);
				process.exit(1);
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
				console.error("Provided image extension is unsupported");
				process.exit(1);
			}

			try {
				//encoding for jpg/avif/webp
				await new _RasterizedImageWorker({
					cpuAllocation: this.#cpuAllocation,
				}).encode(imagePaths, encodeOptions, destinationBasePath);

				console.log(
					`[${currentTime()}] ===> Images are optimised with ${targetFormat.toUpperCase()} format.`,
				);
			} catch (error) {
				console.error(
					"Something wrong occurred while encoding images\n",
					error,
				);
				process.exit(1);
			}
		}
	}
}
