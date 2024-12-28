import { Cheerio, CheerioAPI, load } from "cheerio/slim";

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import {
	ImageTagsRecord,
	ScreenSizesRecordType,
	SrcRecordType,
} from "../../../types";
import { batchProcess, initProgressBar, terminate } from "../../../utils";
import { getImageSizes } from "./cssrender";

export default class HTMLParser {
	#screenSizes: ScreenSizesRecordType;

	constructor(screenSizes: ScreenSizesRecordType) {
		this.#screenSizes = screenSizes;
	}

	/* Responsible to process image tags, one at a time */
	#_processImgTag(
		tag: Cheerio<Element | any>,
		htmlfile: string,
		htmlTree: CheerioAPI,
	): Promise<SrcRecordType> {
		// extracting src
		let imageLink: string | false = htmlTree(tag).attr("src") || false;
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
		let id: string | false = htmlTree(tag).attr("id") || false;
		id = id ? `#${id}` : false;

		// extracting classes
		const classes: string = htmlTree(tag).attr("class") || "";
		const classList: string[] = classes
			? classes.split(/\s+/).map((classname) => `.${classname}`)
			: [];

		const imgTagReference: string = htmlTree(tag).toString();

		return new Promise((resolve, reject) => {
			const selectors: { id: string | false; classes: string[] } = {
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
						attributes: htmlTree(tag).attr(),
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
		for (const promisedFunc of promises) {
			try {
				const srcRecord: SrcRecordType = await promisedFunc();
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
		batchSize: number,
	): Promise<ImageTagsRecord[]> {
		const progressBar = initProgressBar({
			context: "Extracting Image Records",
		});

		progressBar.start(htmlFiles.length, 0);

		const htmlParsePromises: (() => Promise<ImageTagsRecord>)[] =
			htmlFiles.map((htmlFile) => async (): Promise<ImageTagsRecord> => {
				const imageTagsRecord = await this.#_extractImagesRecord(htmlFile);
				progressBar.increment();
				return imageTagsRecord;
			});

		const recordTable: ImageTagsRecord[] = await batchProcess({
			promisedProcs: htmlParsePromises,
			batchSize: batchSize,
			context: "Image Records Extractor",
		});
		progressBar.stop();
		console.log("");

		return recordTable;
	}
}
