import { Cheerio, CheerioAPI, load } from "cheerio";
import { readFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import configurations from "../../configLoader";
import { ImageAttributes, ImageTagsRecord, SrcRecord } from "../types";
import { getImageSize } from "./cssrender";
const {
	imageSetConfigurations: { screenSizes },
} = configurations;

/* Responsible to process image tags, one at a time */
function _processImgTag(
	tag: Cheerio<Element | any>,
	htmlfile: string,
	htmlTree: CheerioAPI,
): Promise<SrcRecord> {
	// extracting src
	let imageLink: string = htmlTree(tag).attr("src") ?? "";
	imageLink = join(dirname(htmlfile), imageLink);

	// extracting id
	let id: string = htmlTree(tag).attr("id") ?? "";
	id = id ? `#${id}` : "";

	// extracting classes
	const classes: string = htmlTree(tag).attr("class") ?? "";
	const classList: string[] = classes
		? classes.split(/\s+/).map((classname) => `.${classname}`)
		: [];

	//require attributes for (<picture>)imagesets of per img tag
	const attributes: ImageAttributes = {
		id: id.slice(1),
		class: classes,
		alt: htmlTree(tag).attr("alt") ?? "",
		loading: htmlTree(tag).attr("loading") ?? "",
		style: htmlTree(tag).attr("style") ?? "",
	};

	const imgTagReference: string = htmlTree(tag).toString();

	return new Promise((complete, reject) => {
		const selectors: { id: string; classes: string[] } = {
			id: id,
			classes: classList,
		};

		getImageSize(selectors, htmlfile, screenSizes)
			.then((imageSizes) => {
				const imageRecord: SrcRecord = new SrcRecord(
					imgTagReference,
					imageLink,
					id,
					classList,
					imageSizes,
					attributes,
				);

				complete(imageRecord);
			})
			.catch((error) => {
				reject(error);
			});
	});
}

//Responsible to process image tags simultaneosly
async function processImgTags(
	imgTags: Cheerio<Element>[],
	htmlfile: string,
	htmlTree: CheerioAPI,
): Promise<ImageTagsRecord> {
	const promises: (() => Promise<SrcRecord>)[] = [];

	//Mapping pr to each img-tag.
	for (let index = 0; index < imgTags.length; index++) {
		promises.push(() => {
			return _processImgTag(imgTags[index], htmlfile, htmlTree);
		});
	}

	/* Batching promises */
	const batchSize: number = 1;
	const promiseBatches: (() => Promise<SrcRecord>)[][] = [];

	for (let i = 0; i < promises.length; i += batchSize) {
		promiseBatches.push(promises.slice(i, i + batchSize));
	}

	const records: SrcRecord[] = [];

	/* Activating batches */
	for (const batch of promiseBatches) {
		const activatedBatch: Promise<SrcRecord>[] = batch.map((func) =>
			func(),
		);

		try {
			const srcRecord: SrcRecord[] = await Promise.all(activatedBatch);
			records.push(...srcRecord);
		} catch (err) {
			console.log(err);
		}
	}

	const imageTagsRecord: ImageTagsRecord = {
		htmlFile: htmlfile,
		ImageRecords: records,
	};

	return imageTagsRecord;
}

function _extractImagesRecord(htmlfile: string): Promise<ImageTagsRecord> {
	//Make absolute path
	htmlfile = resolve(htmlfile);

	return new Promise((complete, reject) => {
		readFile(htmlfile, { encoding: "utf8" }).then(
			(htmlContent: string) => {
				//parse html tree
				const htmlTree: CheerioAPI = load(htmlContent);

				//find img tags
				const imgTags: any = htmlTree("img");

				if (!imgTags) {
					//close if it's no img tag
					complete({} as ImageTagsRecord);
				}

				processImgTags(imgTags, htmlfile, htmlTree)
					.then((recordObjects: ImageTagsRecord) => {
						complete(recordObjects);
					})
					.catch((error) => {
						reject(error);
					}); //processImgTags ended
			},
		); //readFile ended
	}); //Promise ended
}

export async function htmlParser(
	htmlFiles: string[],
	batchSize: number = 2,
): Promise<ImageTagsRecord[]> {
	const htmlParsePromises: (() => Promise<ImageTagsRecord>)[] = [];

	for (const htmlfile of htmlFiles) {
		htmlParsePromises.push((): Promise<ImageTagsRecord> => {
			return _extractImagesRecord(htmlfile);
		});
	}

	const recordTable: ImageTagsRecord[] = [];

	/*  */
	const promiseBatches: (() => Promise<ImageTagsRecord>)[][] = [];

	/* Batching promises */
	for (let i = 0; i < htmlParsePromises.length; i += batchSize) {
		promiseBatches.push(htmlParsePromises.slice(i, i + batchSize));
	}
	/* Activating batches */
	for (const batch of promiseBatches) {
		const activatedBatch: Promise<ImageTagsRecord>[] = batch.map((func) =>
			func(),
		);

		try {
			const records = await Promise.all(activatedBatch);

			recordTable.push(...records);
		} catch (err) {
			console.log(err);
		}
	}
	/*  */

	/* writeFileSync(
		process.cwd() + "/op.json",
		JSON.stringify(recordTable, null, 2),
	); */
	return recordTable;
}
