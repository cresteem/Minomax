import { Cheerio, CheerioAPI, Element, load } from "cheerio";
import { readFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import configurations from "../../configLoader";
import { ImageAttributes, ImageTagsRecord, SrcRecord } from "../options";
import { getImageSize } from "./cssrender";
const {
	imageSetConfigurations: { screenSizes },
} = configurations;

/*
 *@param_1 - tag {Cheerio Elem} => img tag to process
 *@param_2 - htmlfile {String} => html file url to render and find W & H of img.
 *@param_3 - htmlTree {Cheerio API} => cheerio html tree
 */
/* Responsible to process image tags, one at a time */
function _processImgTag(
	tag: Cheerio<Element>,
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
		id: id,
		class: classes,
		alt: htmlTree(tag).attr("alt") ?? "",
		loading: htmlTree(tag).attr("loading") ?? "",
		style: htmlTree(tag).attr("style") ?? "",
	};

	return new Promise((complete, reject) => {
		const selectors: { id: string; classes: string[] } = {
			id: id,
			classes: classList,
		};

		getImageSize(selectors, htmlfile, screenSizes)
			.then((imageSizes) => {
				const imageRecord: SrcRecord = new SrcRecord(
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

/*
 *@param_1 - imgTags {Cheerio<Element>[]} => List of Available img tags to process
 *@param_2 - htmlfile {String} => html file url to render and find W & H of img.
 *@param_3 - htmlTree {Cheerio} => cheerio html tree
 */
//Responsible to process image tags simultaneosly
function processImgTags(
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

	return new Promise((complete, reject) => {
		//calling all promised functions
		Promise.all(promises.map((func) => func()))
			.then((records: SrcRecord[]) => {
				const imageTagsRecord: ImageTagsRecord = {
					htmlFile: htmlfile,
					ImageRecords: records,
				};

				complete(imageTagsRecord);
			})
			.catch((error) => {
				reject(error);
			});
	});
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
): Promise<ImageTagsRecord[]> {
	const htmlParsePromises: (() => Promise<ImageTagsRecord>)[] = [];

	for (const htmlfile of htmlFiles) {
		htmlParsePromises.push(() => {
			return _extractImagesRecord(htmlfile);
		});
	}

	const recordTable: ImageTagsRecord[] = await Promise.all(
		htmlParsePromises.map((func) => func()),
	);

	/* writeFileSync(
		process.cwd() + "/op.json",
		JSON.stringify(recordTable, null, 2),
	); */

	return recordTable;
}
