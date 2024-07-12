import { CheerioAPI, Element, load } from "cheerio";
import { readFile, writeFile } from "fs/promises";
import {
	ImageTagsRecord,
	ImgTagTransResponse,
	PictureTagMakerResponse,
	SrcRecord,
} from "lib/options";
import { makeDirf } from "lib/utils";
import { basename, dirname, extname, join, relative, resolve } from "path";
import configurations from "../../configLoader";
const {
	imageSetConfigurations: { screenSizes },
} = configurations;

export function imgSetPathMaker(
	metaOfHtmls: ImageTagsRecord[],
): Record<string, Record<string, string>> {
	/* results holder */
	//Records<htmlfilename,record<screeenKey,imagepath>>
	const imageSetsPath: Record<string, Record<string, string>> = {};

	metaOfHtmls.forEach((metaofHtml: ImageTagsRecord) => {
		metaofHtml.ImageRecords.forEach((srcRecord: SrcRecord) => {
			const srcPath: string = srcRecord.imageLink;

			const baseImage: string = relative(".", srcPath);

			const imageSizes: Record<string, number> = srcRecord.imageSizes;

			const imageUniqueKey = srcRecord.imageLink;

			imageSetsPath[imageUniqueKey] = {};

			for (const setType of Object.keys(imageSizes)) {
				const isSVG: boolean = extname(baseImage) === ".svg";

				if (isSVG) {
					const svgFileDestPath = join(
						dirname(srcPath),
						"svg",
						basename(baseImage),
					);

					imageSetsPath[imageUniqueKey]["svg"] = svgFileDestPath.replace(
						/\\/g,
						"/",
					);
				} else if (!isSVG) {
					const nonSvgFileName: string =
						basename(baseImage, extname(baseImage)) +
						`@${setType}${extname(baseImage)}`;

					const nonSvgFileDestPath: string = join(
						dirname(srcPath),
						setType,
						nonSvgFileName,
					);

					imageSetsPath[imageUniqueKey][setType] =
						nonSvgFileDestPath.replace(/\\/g, "/");
				}
			}
		});
	});

	return imageSetsPath;
}

function _pictureTagMaker(
	htmlsRecords: ImageTagsRecord[],
): Record<string, PictureTagMakerResponse[]> {
	/* Results holder */
	//Record<Htmlfilename,Records>
	const pictureTags: Record<string, PictureTagMakerResponse[]> = {};

	//Making paths
	const imageSetsPaths: Record<
		string,
		Record<string, string>
	> = imgSetPathMaker(htmlsRecords);

	const mediaTargets: number[] = Object.values(screenSizes);
	const mediaTargetKeys: string[] = Object.keys(screenSizes);

	for (const htmlRecords of htmlsRecords) {
		pictureTags[htmlRecords.htmlFile] = [];

		for (const srcRecord of htmlRecords.ImageRecords) {
			let pictureTag: string;

			const imageUniqueKey: string = srcRecord.imageLink;

			const isSVG: boolean = extname(srcRecord.imageLink) === ".svg";

			if (isSVG) {
				const relativeSrcPath: string = relative(
					dirname(htmlRecords.htmlFile),
					imageSetsPaths[imageUniqueKey]["svg"],
				);

				pictureTag = `<img src="${relativeSrcPath}" `;

				//setting attributes
				for (const [attrname, attrValue] of Object.entries(
					srcRecord.attributes,
				)) {
					if (!attrValue) {
						continue;
					}

					pictureTag += ` ${attrname}="${attrValue}"`;
				}

				//closing img tag
				pictureTag += ">";
			} else {
				pictureTag = "<picture>";

				for (let index = 0; index < mediaTargets.length; index++) {
					const relativeSrcPath: string = relative(
						dirname(htmlRecords.htmlFile),
						imageSetsPaths[imageUniqueKey][mediaTargetKeys[index]],
					);

					pictureTag += `<source media="(max-width:${mediaTargets[index]}px)" srcset="${relativeSrcPath}">`;
				}

				//setting second level image as fallback "2x"=index 1
				const relativeSrcPath: string = relative(
					dirname(htmlRecords.htmlFile),
					imageSetsPaths[imageUniqueKey][mediaTargetKeys[1]],
				);

				pictureTag += `<img src="${relativeSrcPath}" `;

				//setting attributes
				for (const [attrname, attrValue] of Object.entries(
					srcRecord.attributes,
				)) {
					if (!attrValue) {
						continue;
					}

					pictureTag += ` ${attrname}="${attrValue}"`;
				}

				//closing img tag and picture tag
				pictureTag += "> </picture>";
			}

			pictureTags[htmlRecords.htmlFile].push({
				imgTagReference: srcRecord.imgTagReference,
				newTag: pictureTag,
			});
		}
	}
	return pictureTags;
}

function _writeHTMLFile(
	htmlString: string,
	destinationPath: string,
): Promise<void> {
	return new Promise((resolve, reject) => {
		makeDirf(dirname(destinationPath));

		writeFile(destinationPath, htmlString, { encoding: "utf8" })
			.then(() => {
				resolve();
			})
			.catch((err) => {
				reject(err);
			});
	});
}

function _videoThumbnailLinker(
	htmlFilePath: string,
	htmlContent: string,
): string {
	// Load the HTML content into Cheerio
	const htmlTree: CheerioAPI = load(htmlContent);

	//video thumbnail includer
	const videoTags: Element[] = htmlTree("video") as any;

	for (const videoTag of videoTags) {
		let videoUrl: string =
			htmlTree(videoTag).find("source").attr("src") ?? "";
		videoUrl = resolve(join(dirname(htmlFilePath), videoUrl));

		const thumbnailUrl: string = join(
			dirname(videoUrl),
			"thumbnails",
			basename(videoUrl, extname(videoUrl)) + ".jpg",
		);

		const relativeSrcPath: string = relative(
			dirname(htmlFilePath),
			thumbnailUrl,
		).replace(/\\/g, "/");

		htmlTree(videoTag).attr("poster", relativeSrcPath);
	}

	const htmlString: string = htmlTree.root().toString();

	return htmlString;
}

async function _imgTagTransformer(
	htmlsRecords: ImageTagsRecord[],
	batchSize: number = 5,
) {
	//making picture tag for img tag
	const pictureTags: Record<string, PictureTagMakerResponse[]> =
		_pictureTagMaker(htmlsRecords);

	const htmlFiles: string[] = Object.keys(pictureTags);

	const promises: (() => Promise<ImgTagTransResponse>)[] = [];

	for (const htmlFile of htmlFiles) {
		promises.push((): Promise<ImgTagTransResponse> => {
			return new Promise((resolve, reject) => {
				readFile(htmlFile, { encoding: "utf-8" })
					.then((htmlContent: string) => {
						let updatedContent: string = htmlContent;

						const currentFilePictureTags = pictureTags[htmlFile];

						for (
							let index = 0;
							index < currentFilePictureTags.length;
							index++
						) {
							//replace tags
							updatedContent = updatedContent.replace(
								currentFilePictureTags[index].imgTagReference,
								currentFilePictureTags[index].newTag,
							);
						}

						resolve({
							htmlFilePath: htmlFile,
							updatedContent: updatedContent,
						});
					})
					.catch((err: Error) => {
						reject("error while replacing " + err);
					});
			});
		});
	}

	const promiseBatches = [];

	for (let i = 0; i < promises.length; i += batchSize) {
		promiseBatches.push(promises.slice(i, i + batchSize));
	}

	let transformedHtmls: ImgTagTransResponse[] = [];

	for (const batch of promiseBatches) {
		const activatedBatch: Promise<ImgTagTransResponse>[] = batch.map(
			(func) => func(),
		);

		const batchResult: ImgTagTransResponse[] = await Promise.all(
			activatedBatch,
		);

		transformedHtmls = transformedHtmls.concat(batchResult);
	}

	return transformedHtmls;
}

export default async function transformer(
	htmlsRecords: ImageTagsRecord[],
	destinationBase: string = "dist",
	batchSize: number = 5,
) {
	const transformedHtmls: ImgTagTransResponse[] = await _imgTagTransformer(
		htmlsRecords,
		batchSize,
	);

	const promises: (() => Promise<void>)[] = [];

	transformedHtmls.forEach((transformedHtml) => {
		const newDestination: string = join(
			destinationBase,
			relative(".", transformedHtml.htmlFilePath),
		);

		const result: string = _videoThumbnailLinker(
			transformedHtml.htmlFilePath,
			transformedHtml.updatedContent,
		);

		promises.push((): Promise<void> => {
			return new Promise((resolve, reject) => {
				_writeHTMLFile(result, newDestination)
					.then(() => {
						resolve();
					})
					.catch(reject);
			});
		});
	});

	const promiseBatches: (() => Promise<void>)[][] = [];

	/* Batching promises */
	for (let i = 0; i < promises.length; i += batchSize) {
		promiseBatches.push(promises.slice(i, i + batchSize));
	}
	/* Activating batches */
	for (const batch of promiseBatches) {
		const activatedBatch: Promise<void>[] = batch.map((func) => func());
		await Promise.all(activatedBatch);
	}
}
