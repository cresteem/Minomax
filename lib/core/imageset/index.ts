import { globSync } from "glob";

import { existsSync } from "node:fs";
import { freemem } from "node:os";
import { extname, join, relative } from "node:path";

import {
	ConfigurationOptions,
	ImageSetGenRecord,
	ImageTagsRecord,
	SrcRecordType,
} from "../../types";
import { currentTime, terminate } from "../../utils";
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
						console.log(
							"Avif image source is not supported to make image sets, so skipping it.\n->\t" +
								baseImagePath,
						);

						continue;
					} else {
						const rasterisedImageSetGenerator =
							new RasterisedImageSetGenerator(
								this.#configurations.imageSetConfigurations,
							);

						const imageSetGenPromises = Object.values(record.imageSet).map(
							(meta) => () =>
								rasterisedImageSetGenerator.main({
									baseImagePath,
									targetWidth: meta.width,
									destinationPath: meta.path,
								}),
						);

						promisedProcs.push(...imageSetGenPromises);
					}
				} else {
					const destinationPath: string = join(
						destinationBase,
						relative(process.cwd(), record.imageSet["1X"].path),
					);

					promisedProcs.push(() =>
						svgGen({ baseImagePath, destinationPath }),
					);
				}
			} else {
				console.log(`${baseImagePath} not existing so skipping it.`);
			}
		}

		return promisedProcs;
	}

	async #_batchProcess(
		promisedProcs: (() => Promise<void>)[],
		batchSize: number,
	): Promise<void> {
		/* Batching promises */
		const generatorBatchSize: number = batchSize * 4;
		const promiseBatches: (() => Promise<void>)[][] = [];

		for (let i = 0; i < promisedProcs.length; i += generatorBatchSize) {
			promiseBatches.push(promisedProcs.slice(i, i + generatorBatchSize));
		}

		/* Activating batches */
		for (const batch of promiseBatches) {
			const activatedBatch: Promise<void>[] = batch.map((func) => func());

			try {
				await Promise.all(activatedBatch);
			} catch (err) {
				terminate({
					reason: "Batch process failed at image generator\t" + err,
				});
			}
		}
	}

	/*
	 *@param_1 - htmlPathGlob {String} || {Array} => path(s) of html file(s).
	 *@param_2 - destination {String} => file destination =require( root to make all outputs.
	 */
	async generate(
		htmlPathPatterns: string[],
		destinationBase: string = this.#configurations.destPath,
		ignorePatterns: string[],
	) {
		const freememInMB: number = Math.floor(freemem() / 1024 / 1024);
		const batchSize: number = Math.round(freememInMB / 2000);

		const htmlFiles: string[] = globSync(htmlPathPatterns, {
			ignore: ignorePatterns,
			absolute: true,
		});

		console.log(
			`\n[${currentTime()}] +++> ⏰ Imageset generation started.`,
		);
		console.log(`Number of HTML file in queue: ${htmlFiles.length}`);
		console.log(`Number of HTML file at a time: ${batchSize}`);

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
				const imageSetMeta = this.#_makeImageSetMeta(
					imgMeta,
					destinationBase,
					imageSetPaths,
				);

				imageSetRecords.push(imageSetMeta);
			}
		}

		const promisedProcs: (() => Promise<void>)[] =
			this.#_imageGenProcAssigner(destinationBase, imageSetRecords);

		await this.#_batchProcess(promisedProcs, batchSize);

		console.log(
			`[${currentTime()}] ===> ✅ Imageset generation completed.`,
		);

		console.log(
			`\n[${currentTime()}] +++> ⏰ Img tags transformation & Video thumbnail linking started.`,
		);
		/* Transform img tags to picture tags*/
		const rwBatchSize: number = batchSize * 5;
		await this.#imgTagTransformer.transform(
			imagesMetaofHtmls,
			destinationBase,
			rwBatchSize,
		);

		console.log(`[${currentTime()}] ===> ✅ Transformation completed.`);
	}
}
