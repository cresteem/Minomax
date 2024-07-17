import { htmlParser } from "./htmlparser";

import { existsSync } from "fs";
import { globSync } from "glob";
import { freemem } from "os";
import { extname, join, relative } from "path";
import configurations from "../../configLoader";
import { ImageSetGenRecord, ImageTagsRecord } from "../options";
import nonSvgGen from "./generators/nonsvg";
import svgGen from "./generators/svg";
import transformer, { imgSetPathMaker } from "./transformer";
const {
	imageSetConfigurations: { screenSizes },
} = configurations;

/*
 *@param_1 - htmlPathGlob {String} || {Array} => path(s) of html file(s).
 *@param_2 - destination {String} => file destination =require( root to make all outputs.
 */
export default async function imageGenerator(
	htmlPathPatterns: string[],
	destinationBase: string,
) {
	const freememInMB: number = Math.floor(freemem() / 1024 / 1024);
	const batchSize: number = Math.round(freememInMB / 2000);

	//making metadata for images that available in html
	const htmlFiles: string[] = globSync(htmlPathPatterns);
	const imagesMetaofHtmls: ImageTagsRecord[] = await htmlParser(
		htmlFiles,
		batchSize,
	);

	/* path of each images */
	const imageSetPaths: Record<
		string,
		Record<string, string>
	> = imgSetPathMaker(imagesMetaofHtmls);

	const screenKeys: string[] = Object.keys(screenSizes);

	/* Make new record */
	const newRecords: ImageSetGenRecord[] = [];

	for (const imagesMetaofHtml of imagesMetaofHtmls) {
		for (const imgMeta of imagesMetaofHtml.ImageRecords) {
			const imageSet: Record<string, { path: string; width: number }> = {};

			const isSVG: boolean = extname(imgMeta.imageLink) === ".svg";
			if (!isSVG) {
				screenKeys.forEach((screenKey: string) => {
					imageSet[screenKey] = {
						path: join(
							destinationBase,
							relative(
								process.cwd(),
								imageSetPaths[imgMeta.imageLink][screenKey],
							),
						),
						/* @ts-ignore */
						width: imgMeta.imageSizes[screenKey]?.width ?? 0,
					};
				});
			} else {
				imageSet[screenKeys[0]] = {
					path: imageSetPaths[imgMeta.imageLink]["svg"],
					width: 0,
				};
			}

			newRecords.push({
				baseImagePath: imgMeta.imageLink,
				imageSet: imageSet,
			});
		}
	}

	const promises: (() => Promise<void>)[] = [];

	for (const record of newRecords) {
		const baseImagePath: string = record.baseImagePath;

		if (existsSync(baseImagePath)) {
			const isSVG: boolean = extname(baseImagePath) === ".svg";
			const isAvif: boolean = extname(baseImagePath) === ".avif";

			if (isSVG) {
				const destinationPath: string = join(
					destinationBase,
					relative(process.cwd(), record.imageSet["1X"].path),
				);

				promises.push(() => {
					return svgGen(baseImagePath, destinationPath);
				});
			} else if (isAvif) {
				console.log(
					"Avif image source is not supported to make image sets",
				);
				continue;
			} else {
				/* Non SVG promises */
				for (const meta of Object.values(record.imageSet)) {
					promises.push(() => {
						return nonSvgGen(baseImagePath, meta.width, meta.path);
					});
				}
			}
		} else {
			console.log(`${baseImagePath} not existing so skipping it`);
			continue;
		}
	}

	/* Batching promises */
	const promiseBatches: (() => Promise<void>)[][] = [];

	for (let i = 0; i < promises.length; i += batchSize) {
		promiseBatches.push(promises.slice(i, i + batchSize));
	}

	/* Activating batches */
	for (const batch of promiseBatches) {
		const activatedBatch: Promise<void>[] = batch.map((func) => func());
		try {
			await Promise.all(activatedBatch);
		} catch (err) {
			console.log(err);
		}
	}

	/* Transform img tags to picture tags*/
	const rwBatchSize: number = batchSize * 5;
	await transformer(imagesMetaofHtmls, destinationBase, rwBatchSize);
}
