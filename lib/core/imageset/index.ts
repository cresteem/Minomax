import { globSync } from "glob";

import { existsSync } from "node:fs";
import { freemem } from "node:os";
import { extname, join, relative } from "node:path";

import {
	ConfigurationOptions,
	ImageSetGenRecord,
	ImageTagsRecord,
	ImageWorkerOutputTypes,
	SrcRecordType,
} from "../../types";
import {
	batchProcess,
	currentTime,
	initProgressBar,
	logWriter,
	terminate,
} from "../../utils";
import RasterisedImageSetGenerator from "./imageset.lib/generators/nonsvg";
import svgGen from "./imageset.lib/generators/svg";
import HTMLParser from "./imageset.lib/htmlparser";
import ImgTagTransformer from "./imageset.lib/transformer";

export default class ImageSetGenerator {
	#imgTagTransformer: ImgTagTransformer;
	#configurations: ConfigurationOptions;

	constructor(configurations: ConfigurationOptions) {
		this.#imgTagTransformer = new ImgTagTransformer(configurations);
		this.#configurations = configurations;
	}

	#_makeImageSetMeta(
		imgMeta: SrcRecordType,
		destinationBase: string,
		imageSetPaths: Record<string, Record<string, string>>,
	): ImageSetGenRecord {
		const screenKeys: string[] = Object.keys(
			this.#configurations.imageSetConfigurations.screenSizes,
		);

		const imageSetMeta: Record<string, { path: string; width: number }> =
			{};

		const isRasterizedImage: boolean =
			extname(imgMeta.imageLink) !== ".svg";

		if (isRasterizedImage) {
			screenKeys.forEach((screenKey: string) => {
				imageSetMeta[screenKey] = {
					path: join(
						destinationBase,
						relative(
							process.cwd(),
							imageSetPaths[imgMeta.imageLink][screenKey],
						),
					),
					width: imgMeta.imageSizes[screenKey]?.width || 0,
				};
			});
		} else {
			imageSetMeta[screenKeys[0]] = {
				path: imageSetPaths[imgMeta.imageLink]["svg"],
				width: 0,
			};
		}

		return {
			baseImagePath: imgMeta.imageLink,
			imageSet: imageSetMeta,
		};
	}

	#_imageGenProcAssigner(
		destinationBase: string,
		imageSetRecords: ImageSetGenRecord[],
		progressBar: any,
	): (() => Promise<void>)[] {
		const promisedProcs: (() => Promise<void>)[] = [];

		for (const record of imageSetRecords) {
			const baseImagePath: string = record.baseImagePath;

			if (existsSync(baseImagePath)) {
				const isRasterizedImage: boolean =
					extname(baseImagePath) !== ".svg";

				if (isRasterizedImage) {
					const isAvif: boolean = extname(baseImagePath) === ".avif";

					if (isAvif) {
						logWriter(
							"⭕ Skipping: AVIF is not supported in image set generator\n->\t" +
								relative(process.cwd(), baseImagePath),
						);

						continue;
					} else {
						const rasterisedImageSetGenerator =
							new RasterisedImageSetGenerator(
								this.#configurations.imageSetConfigurations,
							);

						const imageSetGenPromises = Object.values(record.imageSet).map(
							(meta) => async () => {
								try {
									await rasterisedImageSetGenerator.main({
										baseImagePath,
										targetWidth: meta.width,
										destinationPath: meta.path,
									});
									progressBar.increment();
								} catch (err) {
									terminate({ reason: `${err}` });
								}
							},
						);

						promisedProcs.push(...imageSetGenPromises);
					}
				} else {
					const destinationPath: string = join(
						destinationBase,
						relative(process.cwd(), record.imageSet["1X"].path),
					);

					promisedProcs.push(async () => {
						try {
							await svgGen({ baseImagePath, destinationPath });
							progressBar.increment();
						} catch (err) {
							terminate({ reason: `${err}` });
						}
					});
				}
			} else {
				logWriter(
					`⭕ Skipping: ${relative(process.cwd(), baseImagePath)}`,
				);
			}
		}

		progressBar.start(promisedProcs.length, 0);

		return promisedProcs;
	}

	/*
	 *@param_1 - htmlPathGlob {String} || {Array} => path(s) of html file(s).
	 *@param_2 - destination {String} => file destination =require( root to make all outputs.
	 */
	async generate({
		htmlPathPatterns,
		ignorePatterns,
		destinationBase = this.#configurations.destPath,
		variableImgFormat,
	}: {
		variableImgFormat: ImageWorkerOutputTypes | false;
		htmlPathPatterns: string[];
		ignorePatterns: string[];
		destinationBase: string;
	}) {
		const freememInMB: number = Math.floor(freemem() / 1024 / 1024);
		const batchSize: number = Math.round(freememInMB / 2000);

		const htmlFiles: string[] = globSync(htmlPathPatterns, {
			ignore: ignorePatterns,
			absolute: true,
		});

		console.log(
			`\n[${currentTime()}] +++> ⏰ Imageset generation started.`,
		);
		console.log(`\nNumber of HTML file in queue: ${htmlFiles.length}`);
		console.log(`Number of HTML file at a time: ${batchSize}\n`);

		//making metadata for images that available in html
		const imagesMetaofHtmls: ImageTagsRecord[] = await new HTMLParser(
			this.#configurations,
		).extractImagesMeta(htmlFiles, batchSize);

		/* path of each images */
		const imageSetPaths: Record<
			string,
			Record<string, string>
		> = this.#imgTagTransformer.imgSetPathMaker(imagesMetaofHtmls);

		/* Make new record */
		const imageSetRecords: ImageSetGenRecord[] = [];

		for (const imagesMetaofHtml of imagesMetaofHtmls) {
			for (const imgMeta of imagesMetaofHtml.imageRecords) {
				const currentImageSetMeta = this.#_makeImageSetMeta(
					imgMeta,
					destinationBase,
					imageSetPaths,
				);

				const notDuplicate = !imageSetRecords.some(
					(existingImgRec) =>
						existingImgRec.baseImagePath ===
						currentImageSetMeta.baseImagePath,
				);

				if (notDuplicate) {
					imageSetRecords.push(currentImageSetMeta);
				}
			}
		}

		/* dumpRunTimeData({
			data: imageSetRecords,
			context: "Imageset Records",
		}); */

		const progressBar = initProgressBar({
			context: "Generating Image Sets",
		});

		const promisedProcs: (() => Promise<void>)[] =
			this.#_imageGenProcAssigner(
				destinationBase,
				imageSetRecords,
				progressBar,
			);

		const generatorBatchSize = batchSize * 4;
		await batchProcess({
			promisedProcs: promisedProcs,
			batchSize: generatorBatchSize,
			context: "Image Generator",
		});
		progressBar.stop();

		console.log(
			`\n[${currentTime()}] ===> ✅ Imageset generation completed.`,
		);

		console.log(
			`\n[${currentTime()}] +++> ⏰ Img tags transformation & Video thumbnail linking started.`,
		);
		/* Transform img tags to picture tags*/
		const rwBatchSize: number = batchSize * 5;
		const { linkedVideos, videoThumbnails } =
			await this.#imgTagTransformer.transform({
				htmlsRecords: imagesMetaofHtmls,
				variableImgFormat: variableImgFormat,
				destinationBase: destinationBase,
				batchSize: rwBatchSize,
			});

		console.log(`[${currentTime()}] ===> ✅ Transformation completed.`);

		//available image and video list
		return {
			linkedVideos: linkedVideos,
			videoThumbnails: videoThumbnails.map((thumbnailPath) =>
				join(destinationBase, relative(process.cwd(), thumbnailPath)),
			),
			linkedImages: Object.values(imageSetPaths)
				.map((set) => Object.values(set))
				.flat()
				.map((imagePath) =>
					join(destinationBase, relative(process.cwd(), imagePath)),
				)
				.filter((imagePath) => existsSync(imagePath)),
		};
	}
}
