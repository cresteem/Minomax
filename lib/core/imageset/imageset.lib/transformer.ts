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
	PictureTagMakerResponse,
	SrcRecordType,
} from "../../../types";
import { batchProcess, terminate, writeContent } from "../../../utils";

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
				const srcPath: string | false = srcRecord.imageLink;

				if (!srcPath) {
					terminate({
						reason: "image link not found in " + srcRecord.imgTagReference,
					});
				}

				const baseImage: string = relative(process.cwd(), srcPath);

				//img path as key
				const imageUniqueKey = srcPath;

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

	#_imgTagBuilder(
		pictureTag: string,
		imagePath: string,
		attrRecord: Record<string, string> | undefined,
	) {
		pictureTag += `<img src="${imagePath}" `;

		//setting attributes
		for (const [attrname, attrValue] of Object.entries(attrRecord || {})) {
			if (attrname === "src") {
				continue;
			}

			pictureTag += ` ${attrname}${attrValue ? `="${attrValue}"` : ""}`;
		}

		//closing img tag
		pictureTag += "/>";

		return pictureTag;
	}

	#_getImageRelPath(
		htmlPath: string,
		imagePath: string,
		variableImgFormat: string | false,
	) {
		return relative(
			dirname(htmlPath),
			`${join(
				dirname(imagePath),
				basename(imagePath, extname(imagePath)),
			)}${
				variableImgFormat ? "." + variableImgFormat : extname(imagePath)
			}`,
		);
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

				const imageLink = srcRecord.imageLink;

				if (!imageLink) {
					terminate({
						reason: "image link not found in " + srcRecord.imgTagReference,
					});
				}

				const imageUniqueKey: string = imageLink;

				const isSVG: boolean = extname(imageLink) === ".svg";

				if (isSVG) {
					const relativeSrcPath: string = relative(
						dirname(htmlTagRecord.htmlFile),
						imageSetsPaths[imageUniqueKey]["svg"],
					);
					pictureTag = this.#_imgTagBuilder(
						"",
						relativeSrcPath,
						srcRecord.attributes,
					);
				} else {
					pictureTag = "<picture>";

					mediaTargets.forEach((mediaTarget, index) => {
						const imagePath =
							imageSetsPaths[imageUniqueKey][mediaTargetKeys[index]];

						const relativeSrcPath: string = this.#_getImageRelPath(
							htmlTagRecord.htmlFile,
							imagePath,
							variableImgFormat,
						);

						pictureTag += `<source media="(max-width:${mediaTarget}px)" srcset="${relativeSrcPath}">`;
					});

					//setting second level image as fallback "2x"
					const imagePath =
						imageSetsPaths[imageUniqueKey][
							mediaTargetKeys[mediaTargetKeys.length - 2]
						];
					const fallbackSrcPath: string = this.#_getImageRelPath(
						htmlTagRecord.htmlFile,
						imagePath,
						variableImgFormat,
					);

					pictureTag += this.#_imgTagBuilder(
						pictureTag,
						fallbackSrcPath,
						srcRecord.attributes,
					);

					//closing picture tag
					pictureTag += "</picture>";
				}

				pictureTags[htmlTagRecord.htmlFile].push({
					imgTagReference: srcRecord.imgTagReference,
					newTag: pictureTag,
				});
			}
		}
		return pictureTags;
	}

	async transform({
		htmlsRecords,
		variableImgFormat,
		destinationBase,
		batchSize /* Read and write only */,
	}: {
		htmlsRecords: ImageTagsRecord[];
		variableImgFormat: ImageWorkerOutputTypes | false;
		destinationBase: string;
		batchSize: number;
	}): Promise<void> {
		//making picture tag for img tag
		const pictureTags: Record<string, PictureTagMakerResponse[]> =
			this.#_pictureTagMaker(htmlsRecords, variableImgFormat);

		const htmlFiles: string[] = Object.keys(pictureTags);

		const transformerPromises: (() => Promise<void>)[] = htmlFiles.map(
			(htmlFile) => () =>
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

							const newDestination: string = join(
								destinationBase,
								relative(process.cwd(), htmlFile),
							);

							writeContent(updatedContent, newDestination)
								.then(resolve)
								.catch((err) => {
									reject(
										`Error while writing transformed HTML to ${newDestination}\n${err}`,
									);
								});
						})
						.catch((err: Error) => {
							reject(
								`Error reading file at transformer, file: ${htmlFile} \n${err}`,
							);
						});
				}),
		);

		await batchProcess({
			promisedProcs: transformerPromises,
			batchSize: batchSize,
			context: "Image Tag Transformers",
		});
	}
}
