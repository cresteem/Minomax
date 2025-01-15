import { load } from "cheerio/slim";
import { globSync } from "glob";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { cpus } from "node:os";
import {
	dirname,
	extname,
	resolve as fsResolve,
	join,
	relative,
} from "node:path";
import { batchProcess } from "../../lib/utils";
import { Minomax } from "../../minomax";

const minomax = new Minomax();

const numberOfImagePerSet = Object.values(
	minomax.configurations.imageWorker.set.screenSizes,
).length;

function _countImageTags(
	htmlFilePath: string,
): Promise<{ svg: number; nonSvg: number }> {
	return new Promise((resolve, reject) => {
		readFile(htmlFilePath, "utf-8")
			.then((htmlContent) => {
				const $ = load(htmlContent);
				let svg = 0;
				let nonSvg = 0;

				$("img").each((_idx, elem) => {
					const imageSource = $(elem).attr("src");
					if (imageSource) {
						const isSvg = extname(imageSource) === ".svg";

						const imagePath = fsResolve(
							relative(
								process.cwd(),
								join(dirname(htmlFilePath), imageSource),
							),
						);

						if (existsSync(imagePath)) {
							if (isSvg) {
								svg += 1;
							} else {
								nonSvg += 1;
							}
						}
					}
				});

				const result = { svg: svg, nonSvg: nonSvg };
				resolve(result);
			})
			.catch(reject);
	});
}

async function _validateTagTransformation(
	destinatedFiles: string[],
	expectedPictureTagCount: number,
): Promise<boolean> {
	const validatePromises = destinatedFiles.map(
		(htmlPath) => () =>
			new Promise<Set<string>>((resolve, reject) => {
				readFile(htmlPath, { encoding: "utf8" })
					.then((htmlContent: string) => {
						const $ = load(htmlContent);
						const validPictureTags: Set<string> = new Set();

						$("picture").each((_idx, elem) => {
							const sourceList = $(elem).children("source");

							//(1)
							const sourceList_PASSED =
								sourceList.length === numberOfImagePerSet;

							//break if there is no media query or source not found in any source tag
							sourceList.each((_idx, elem) => {
								const hasMediaQuery = $(elem).attr("media");

								const sourceLink = $(elem).attr("srcset") || "";
								const sourceAbsPath = fsResolve(
									relative(
										process.cwd(),
										join(dirname(htmlPath), sourceLink),
									),
								);

								if (!hasMediaQuery || !existsSync(sourceAbsPath)) {
									reject("No MediaQuery or source image not exists");

									console.debug(
										"hasMediaQuery:",
										hasMediaQuery,
										sourceAbsPath,
									);
								}
							}); // (2) Media_&_Link_PASSED

							const imgLink = $(elem).children("img").first().attr("src");

							// (3) add as passed picture tag or reject
							if (sourceList_PASSED && imgLink) {
								validPictureTags.add(imgLink);
							} else {
								reject(
									`sourceList: ${sourceList_PASSED} or imgLink: ${imgLink}`,
								);
							}

							//resolve number of valid picture tag
							resolve(validPictureTags);
						});
					})
					.catch(reject);
			}),
	);

	const validatedResponses = await batchProcess({
		promisedProcs: validatePromises,
		batchSize: cpus().length,
		context: "_validateTagTransformation",
	});

	const PASSED =
		validatedResponses.reduce((a, b) => {
			b.forEach((val) => {
				a.add(val);
			});

			return a;
		}, new Set()).size === expectedPictureTagCount;

	return PASSED;
}

function _isValidDestPaths(
	sourceFilePaths: string[],
	destFilesPaths: string[],
	destinationBasePath: string,
): boolean {
	destFilesPaths = destFilesPaths.map((destFile) =>
		fsResolve(relative(destinationBasePath, destFile)),
	);

	return (
		new Set(sourceFilePaths).size === new Set(destFilesPaths).size &&
		[...new Set(sourceFilePaths)].every((item) =>
			new Set(destFilesPaths).has(item),
		)
	);
}

export async function imageSetTestConditions({
	lookUpPatterns,
	destinationBasePath,
	ignorePatterns,
	vidThumbnailCount = 0,
}: {
	lookUpPatterns: string[];
	destinationBasePath: string;
	ignorePatterns: string[];
	vidThumbnailCount?: number;
}): Promise<boolean> {
	const expectedHtmlFiles = globSync(lookUpPatterns, {
		absolute: true,
		nodir: true,
		ignore: ignorePatterns,
	}).filter((file) => extname(file) === ".html");

	/* await writeContent(
		JSON.stringify({ lookUpPatterns, expectedHtmlFiles }, null, 3),
		"imgset.log.txt",
	); */

	const imgTagCountPromises = expectedHtmlFiles.map(
		(htmlPath) => () => _countImageTags(htmlPath),
	);

	const availableImageTags = (
		await batchProcess({
			promisedProcs: imgTagCountPromises,
			batchSize: cpus().length,
			context: "Count Img tags",
		})
	).reduce((a, b) => ({
		svg: a.svg + b.svg,
		nonSvg: a.nonSvg + b.nonSvg,
	}));

	const totalExpectedImages =
		availableImageTags.svg +
		availableImageTags.nonSvg * numberOfImagePerSet;

	const destinatedFiles = globSync(`**/*`, {
		cwd: destinationBasePath,
		nodir: true,
		absolute: true,
	}).filter((path) =>
		[".avif", ".webp", ".jpg", ".svg", ".html", ".png"].includes(
			extname(path),
		),
	); //only images and html

	const destinatedFilesCount = destinatedFiles.length;
	const expectedFilesInDestCount =
		expectedHtmlFiles.length + totalExpectedImages + vidThumbnailCount;

	const expectedFilesInDest_PASSED =
		expectedFilesInDestCount === destinatedFilesCount;

	console.log(
		"Imageset - expectedFilesInDest:",
		expectedFilesInDest_PASSED ? "✅ PASSED" : "❌ Failed",
	);

	const destinatedHtmls = destinatedFiles.filter(
		(file) => extname(file) === ".html",
	);

	const expectedPictureTagCount = availableImageTags.nonSvg;

	const tagTransformation_PASSED = await _validateTagTransformation(
		destinatedHtmls,
		expectedPictureTagCount,
	);

	console.log(
		"Imageset - tagTransformation & imageLinksValidation:",
		tagTransformation_PASSED ? "✅ PASSED" : "❌ Failed",
	);

	const destPathValidation_PASSED = _isValidDestPaths(
		expectedHtmlFiles,
		destinatedHtmls,
		destinationBasePath,
	);

	console.log(
		"Imageset - destPathValidation:",
		destPathValidation_PASSED ? "✅ PASSED" : "❌ Failed",
	);

	const PASSED =
		expectedFilesInDest_PASSED &&
		tagTransformation_PASSED &&
		destPathValidation_PASSED;

	return PASSED;
}

export async function testImageSet({
	lookUpPatterns,
	destinationBasePath,
	ignorePatterns,
}: {
	lookUpPatterns: string[];
	destinationBasePath: string;
	ignorePatterns: string[];
}) {
	await minomax.generateImageSets({
		lookUpPatterns: lookUpPatterns,
		ignorePatterns: ignorePatterns,
		destinationBasePath: destinationBasePath,
	});

	return await imageSetTestConditions({
		lookUpPatterns: lookUpPatterns,
		ignorePatterns: ignorePatterns,
		destinationBasePath: destinationBasePath,
	});
}
