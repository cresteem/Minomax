import { load } from "cheerio/slim";
import { readFile } from "node:fs/promises";
import {
	basename,
	dirname,
	extname,
	join,
	relative,
	sep,
} from "node:path";
import {
	ConfigurationOptions,
	ImageTagsRecord,
	ImageWorkerOutputTypes,
	ImgTagTransResponse,
	PictureTagMakerResponse,
	SrcRecordType,
} from "../../../types";
import { batchProcess, writeContent } from "../../../utils";

export default class ImgTagTransformer {
	#screenSizes;

	constructor(configurations: ConfigurationOptions) {
		const {
			imageSetConfigurations: { screenSizes },
		} = configurations;

		this.#screenSizes = screenSizes;
	}

	imgSetPathMaker(
		imgMetaOfHtmls: ImageTagsRecord[],
	): Record<string, Record<string, string>> {
		//Records<htmlfilename,record<screeenKey,imagepath>>
		const imageSetsPath: Record<string, Record<string, string>> = {};

		imgMetaOfHtmls.forEach((metaofHtml: ImageTagsRecord) => {
			metaofHtml.imageRecords.forEach((srcRecord: SrcRecordType) => {
				const srcPath: string = srcRecord.imageLink;

				const baseImage: string = relative(".", srcPath);

				//img path as key
				const imageUniqueKey = srcRecord.imageLink;

				imageSetsPath[imageUniqueKey] = {};

				for (const setType of Object.keys(srcRecord.imageSizes)) {
					const isRasterizedImage: boolean = extname(baseImage) !== ".svg";

					if (isRasterizedImage) {
						const rasterizedImageName: string = basename(
							baseImage,
							extname(baseImage),
						).concat(`@${setType}${extname(baseImage)}`);

						const rasterizedImageDestPath: string = join(
							dirname(srcPath),
							setType,
							rasterizedImageName,
						);

						imageSetsPath[imageUniqueKey][setType] =
							rasterizedImageDestPath.replaceAll(sep, "/");
					} else if (imageSetsPath[imageUniqueKey]["svg"] === undefined) {
						const svgFileDestPath = join(
							dirname(srcPath),
							"svg",
							basename(baseImage),
						);

						imageSetsPath[imageUniqueKey]["svg"] =
							svgFileDestPath.replaceAll(sep, "/");
					}
				}
			});
		});

		return imageSetsPath;
	}

	#_pictureTagMaker(
		htmlsTagRecords: ImageTagsRecord[],
		variableImgFormat: ImageWorkerOutputTypes | false,
	): Record<string, PictureTagMakerResponse[]> {
		/* Results holder */
		//Record<Htmlfilename,Records>
		const pictureTags: Record<string, PictureTagMakerResponse[]> = {};

		//Making paths
		const imageSetsPaths: Record<
			string,
			Record<string, string>
		> = this.imgSetPathMaker(htmlsTagRecords);

		const mediaTargets: number[] = Object.values(
			this.#screenSizes,
		).reverse();
		const mediaTargetKeys: string[] = Object.keys(
			this.#screenSizes,
		).reverse();

		for (const htmlTagRecord of htmlsTagRecords) {
			pictureTags[htmlTagRecord.htmlFile] = [];

			for (const srcRecord of htmlTagRecord.imageRecords) {
				let pictureTag: string;

				const imageUniqueKey: string = srcRecord.imageLink;

				const isSVG: boolean = extname(srcRecord.imageLink) === ".svg";

				if (isSVG) {
					const relativeSrcPath: string = relative(
						dirname(htmlTagRecord.htmlFile),
						imageSetsPaths[imageUniqueKey]["svg"],
					);

					pictureTag = `<img src="${relativeSrcPath}" `;

					//setting attributes
					for (const [attrname, attrValue] of Object.entries(
						srcRecord.attributes || {},
					)) {
						if (attrname === "src") {
							continue;
						}

						pictureTag += ` ${attrname}${
							attrValue ? `="${attrValue}"` : ""
						}`;
					}

					//closing img tag
					pictureTag += "/>";
				} else {
					pictureTag = "<picture>";

					mediaTargets.forEach((mediaTarget, index) => {
						const imagePath =
							imageSetsPaths[imageUniqueKey][mediaTargetKeys[index]];

						const relativeSrcPath: string = relative(
							dirname(htmlTagRecord.htmlFile),
							`${join(
								dirname(imagePath),
								basename(imagePath, extname(imagePath)),
							)}${
								variableImgFormat
									? "." + variableImgFormat
									: extname(imagePath)
							}`,
						);

						pictureTag += `<source media="(max-width:${mediaTarget}px)" srcset="${relativeSrcPath}">`;
					});

					//setting second level image as fallback "2x"
					const imagePath =
						imageSetsPaths[imageUniqueKey][
							mediaTargetKeys[mediaTargetKeys.length - 2]
						];
					const fallbackSrcPath: string = relative(
						dirname(htmlTagRecord.htmlFile),
						`${join(
							dirname(imagePath),
							basename(imagePath, extname(imagePath)),
						)}${
							variableImgFormat
								? "." + variableImgFormat
								: extname(imagePath)
						}`,
					);

					pictureTag += `<img src="${fallbackSrcPath}" `;

					//setting attributes
					for (const [attrname, attrValue] of Object.entries(
						srcRecord.attributes || {},
					)) {
						if (attrname === "src") {
							continue;
						}

						pictureTag += ` ${attrname}${
							attrValue ? `="${attrValue}"` : ""
						}`;
					}

					//closing img tag and picture tag
					pictureTag += "/> </picture>";
				}

				pictureTags[htmlTagRecord.htmlFile].push({
					imgTagReference: srcRecord.imgTagReference,
					newTag: pictureTag,
				});
			}
		}
		return pictureTags;
	}

	async #_imgTagTransformer(
		htmlsTagRecords: ImageTagsRecord[],
		batchSize: number = 5,
		variableImgFormat: ImageWorkerOutputTypes | false,
	): Promise<ImgTagTransResponse[]> {
		//making picture tag for img tag
		const pictureTags: Record<string, PictureTagMakerResponse[]> =
			this.#_pictureTagMaker(htmlsTagRecords, variableImgFormat);

		const htmlFiles: string[] = Object.keys(pictureTags);

		const promises: (() => Promise<ImgTagTransResponse>)[] = htmlFiles.map(
			(htmlFile) => (): Promise<ImgTagTransResponse> =>
				new Promise((resolve, reject) => {
					readFile(htmlFile, { encoding: "utf-8" })
						.then((htmlContent: string) => {
							let updatedContent: string = load(htmlContent).html();

							pictureTags[htmlFile].forEach((pictureTagMeta) => {
								//replace tags

								updatedContent = updatedContent.replace(
									pictureTagMeta.imgTagReference,
									pictureTagMeta.newTag,
								);
							});

							resolve({
								htmlFilePath: htmlFile,
								updatedContent: updatedContent,
							});
						})
						.catch((err: Error) => {
							reject(
								`Error reading file at transformer, file: ${htmlFile} \n${err}`,
							);
						});
				}),
		);

		const transformedHtmls: ImgTagTransResponse[] = await batchProcess({
			promisedProcs: promises,
			batchSize: batchSize,
			context: "Image Tag Transformers",
		});

		return transformedHtmls;
	}

	async transform({
		htmlsRecords,
		variableImgFormat,
		destinationBase = "dist",
		batchSize = 10 /* Read and write only */,
	}: {
		htmlsRecords: ImageTagsRecord[];
		variableImgFormat: ImageWorkerOutputTypes | false;
		destinationBase: string;
		batchSize: number;
	}): Promise<void> {
		const transformedHtmls: Awaited<ImgTagTransResponse[]> =
			await this.#_imgTagTransformer(
				htmlsRecords,
				batchSize,
				variableImgFormat,
			);

		const promises: (() => Promise<void>)[] = transformedHtmls.map(
			(transformedHtml) => (): Promise<void> =>
				new Promise((resolve, reject) => {
					const newDestination: string = join(
						destinationBase,
						relative(process.cwd(), transformedHtml.htmlFilePath),
					);

					writeContent(transformedHtml.updatedContent, newDestination)
						.then(resolve)
						.catch((err) => {
							reject(
								`Error while writing transformed HTML to ${newDestination}\n${err}`,
							);
						});
				}),
		);

		await batchProcess({
			promisedProcs: promises,
			batchSize: batchSize,
			context: "transform(), while writing outputs",
		});
	}
}
