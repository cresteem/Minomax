import { appendFileSync, readFileSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { cpus } from "os";
import { basename, dirname, extname, join, relative } from "path";
import { ImagePool } from "remige";
import { optimize } from "svgo";

import configurations from "../configLoader";
import {
	ImageWorkerOutputTypes,
	avifEncodeOptions,
	jpgEncodeOptions,
	webpEncodeOptions,
} from "./options";
import { currentTime, makeDirf } from "./utils";
const {
	jpgEncodeOptions,
	webpEncodeOptions,
	avifEncodeOptions,
	svgOptions,
	cpuAllocation,
} = configurations.encodeOptions;

function _writeBinaryImage(
	encodeResult: Record<string, any>,
	filePath: string,
): Promise<void> {
	const fileType: string = Object.keys(encodeResult.encodedWith)[0];
	const extension: string = encodeResult.encodedWith[fileType].extension;

	const outputPath: string = join(
		configurations.destPath,
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
				resolve();
			})
			.catch((error: Error) => {
				reject(`Error writing output: ${outputPath}\n` + error.message);
			});
	});
}

function _encodeImages(
	images: string[],
	encodeOptions: Record<string, any>,
): Promise<void> {
	//number of concurrent process.
	/* 50 percentage of core count If there is no cpu allocation in Settings */
	const threadCount: number =
		cpuAllocation ?? Math.floor((70 * cpus().length) / 100);

	const pool = new ImagePool(threadCount);

	/* Ingest images in pool */
	const imagesRecords: {
		encodeResult: Record<string, any>;
		filePath: string;
	}[] = images.map((filePath: string) => {
		return {
			encodeResult: pool.ingestImage(readFileSync(filePath)),
			filePath: filePath,
		};
	});

	/* Encode ingested images and save it */
	const outputPromises: Promise<void>[] = imagesRecords.map(
		(imagesRecord): Promise<void> => {
			return new Promise((resolve, reject) => {
				let { encodeResult, filePath } = imagesRecord;

				encodeResult
					.encode(encodeOptions)
					.then(() => {
						_writeBinaryImage(encodeResult, filePath)
							.then(() => {
								resolve();
							})
							.catch((err: Error) => {
								reject(err);
							});
					})
					.catch((err: Error) => {
						reject(err);
					});
			});
		},
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
						reject(err);
					});
			})
			.catch((err: Error) => {
				reject(err);
			});
	});
}

async function _svgBatchHandler(
	outputPromises: (() => Promise<void>)[],
): Promise<void> {
	const promiseBatches: (() => Promise<void>)[][] = [];

	const batchSize: number = cpuAllocation * 4;

	for (let i = 0; i < outputPromises.length; i += batchSize) {
		promiseBatches.push(outputPromises.slice(i, i + batchSize));
	}

	for (const batch of promiseBatches) {
		const activatedBatch: Promise<void>[] = batch.map((func) => func());

		await Promise.all(activatedBatch);
	}
}

async function _svgWorker(svgImagePaths: string[]): Promise<void> {
	const outputPromises: (() => Promise<void>)[] = svgImagePaths.map(
		(svgPath: string) => {
			return (): Promise<void> => {
				return new Promise((resolve, reject) => {
					readFile(svgPath, { encoding: "utf8" })
						.then((svgData) => {
							let outputSvgData: string = "";

							let failed: boolean = false;

							try {
								outputSvgData = optimize(svgData, svgOptions as any)?.data;
							} catch (err: any) {
								const logMessage: string = `${svgPath} => ${err}`;

								appendFileSync(
									join(process.cwd(), "minomax.err.log"),
									logMessage,
								);

								failed = true;
							}

							if (!failed) {
								const outputPath: string = join(
									configurations.destPath,
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
							} else {
								resolve();
							}
						})
						.catch((error: Error) => {
							reject(`\nError: ${basename(svgPath)}\n` + error);
						});
				});
			};
		},
	);

	try {
		await _svgBatchHandler(outputPromises);
	} catch (err: any) {
		console.log(err);
		process.exit(1);
	}
}

export async function imageWorker(
	imagePaths: string[],
	targetFormat: ImageWorkerOutputTypes,
): Promise<void> {
	process.on("SIGINT", () => {
		process.exit();
	});

	console.log(`Number of images: ${imagePaths.length}`);

	console.log(`[${currentTime()}] +++> Image Encoding Started`);

	if (targetFormat === "svg") {
		await _svgWorker(imagePaths);
		console.log(
			`[${currentTime()}] ===> Images are optimised with SVG format.`,
		);
	} else {
		let encodeOptions:
			| jpgEncodeOptions
			| avifEncodeOptions
			| webpEncodeOptions;

		if (targetFormat === "avif") {
			//avifEncodeOptions
			encodeOptions = avifEncodeOptions;
		} else if (targetFormat === "webp") {
			//webpEncodeOptions
			encodeOptions = webpEncodeOptions;
		} else if (targetFormat === "jpg") {
			//jpgEncodeOptions
			encodeOptions = jpgEncodeOptions;
		} else {
			console.log("Provided type is not supported");
			process.exit(1);
		}

		//encoding for jpg/avif/webp
		await _encodeImages(imagePaths, encodeOptions);

		console.log(
			`[${currentTime()}] ===> Images are optimised with ${targetFormat.toUpperCase()} format.`,
		);
	}
}
