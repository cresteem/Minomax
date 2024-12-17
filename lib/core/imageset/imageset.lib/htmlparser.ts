import { Cheerio, CheerioAPI, load } from "cheerio";

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import {
	ConfigurationOptions,
	ImageAttributes,
	ImageTagsRecord,
	ScreenSizesRecordType,
	SrcRecordType,
} from "../../../types";
import { terminate } from "../../../utils";
import { getImageSizes } from "./cssrender";

export default class HTMLParser {
	#screenSizes: ScreenSizesRecordType;

	constructor(configurations: ConfigurationOptions) {
		const {
			imageSetConfigurations: { screenSizes },
		} = configurations;

		this.#screenSizes = screenSizes;
	}

	/* Responsible to process image tags, one at a time */
	#_processImgTag(
		tag: Cheerio<Element | any>,
		htmlfile: string,
		htmlTree: CheerioAPI,
	): Promise<SrcRecordType> {
		// extracting src
		let imageLink: string = htmlTree(tag).attr("src") || "";
		if (!imageLink) {
			terminate({
				reason: `Image link not found in this img tag at file: ${htmlfile} : ${htmlTree(
					tag,
				).html()} `,
			});
		} else {
			imageLink = join(dirname(htmlfile), imageLink);
		}

		// extracting id
		let id: string = htmlTree(tag).attr("id") || "";
		id = id ? `#${id}` : "";

		// extracting classes
		const classes: string = htmlTree(tag).attr("class") || "";
		const classList: string[] = classes
			? classes.split(/\s+/).map((classname) => `.${classname}`)
			: [];

		//require attributes for (<picture>)imagesets of per img tag
		const attributes: ImageAttributes = {
			id: id.slice(1),
			class: classes,
			alt: htmlTree(tag).attr("alt") || "",
			loading: htmlTree(tag).attr("loading") || "",
			style: htmlTree(tag).attr("style") || "",
		};

		const imgTagReference: string = htmlTree(tag).toString();

		return new Promise((resolve, reject) => {
			const selectors: { id: string; classes: string[] } = {
				id: id,
				classes: classList,
			};

			getImageSizes(selectors, htmlfile, this.#screenSizes)
				.then((imageSizes) => {
					const imageRecord: SrcRecordType = {
						imgTagReference: imgTagReference,
						imageLink: imageLink,
						id: id,
						classes: classList,
						imageSizes: imageSizes,
						attributes: attributes,
					};

					resolve(imageRecord);
				})
				.catch((error) => {
					reject(error);
				});
		});
	}

	//Responsible to process image tags simultaneosly
	async #_processImgTags(
		imgTags: Cheerio<Element>[],
		htmlfile: string,
		htmlTree: CheerioAPI,
	): Promise<ImageTagsRecord> {
		const promises: (() => Promise<SrcRecordType>)[] = imgTags.map(
			(imgTag) => () => this.#_processImgTag(imgTag, htmlfile, htmlTree),
		);

		const imageRecords: SrcRecordType[] = [];

		/* Activating promises */
		for (const promise of promises) {
			try {
				const srcRecord: SrcRecordType = await promise();
				imageRecords.push(srcRecord);
			} catch (err) {
				console.log(err);
			}
		}

		return {
			htmlFile: htmlfile,
			imageRecords: imageRecords,
		};
	}

	#_extractImagesRecord(htmlfile: string): Promise<ImageTagsRecord> {
		//Make absolute path
		htmlfile = resolve(htmlfile);

		return new Promise((resolve, reject) => {
			readFile(htmlfile, { encoding: "utf8" })
				.then((htmlContent: string) => {
					//parse html tree
					const htmlTree: CheerioAPI = load(htmlContent);

					//find img tags
					const imgTags: any = htmlTree("img")?.toArray() || false;

					if (!imgTags) {
						//close if it's no img tag
						resolve({} as ImageTagsRecord);
					}

					this.#_processImgTags(imgTags, htmlfile, htmlTree)
						.then((imageTagsRecords: ImageTagsRecord) => {
							resolve(imageTagsRecords);
						})
						.catch((error) => {
							reject(error);
						}); //processImgTags ended
				})
				.catch((err) => {
					reject(`Error reading HTML file, at ${htmlfile}\n${err}`);
				}); //readFile ended
		}); //Promise ended
	}

	async extractImagesMeta(
		htmlFiles: string[],
		batchSize: number = 2,
	): Promise<ImageTagsRecord[]> {
		const htmlParsePromises: (() => Promise<ImageTagsRecord>)[] =
			htmlFiles.map(
				(htmlFile) => (): Promise<ImageTagsRecord> =>
					this.#_extractImagesRecord(htmlFile),
			);

		const recordTable: ImageTagsRecord[] = [];

		const promiseBatches: (() => Promise<ImageTagsRecord>)[][] = [];

		/* Batching promises */
		for (let i = 0; i < htmlParsePromises.length; i += batchSize) {
			promiseBatches.push(htmlParsePromises.slice(i, i + batchSize));
		}

		/* Activating batches */
		for (const batch of promiseBatches) {
			const activatedBatch: Promise<ImageTagsRecord>[] = batch.map(
				(func) => func(),
			);

			try {
				const records = await Promise.all(activatedBatch);
				recordTable.push(...records);
			} catch (err) {
				console.log(err);
			}
		}

		return recordTable;
	}
}
