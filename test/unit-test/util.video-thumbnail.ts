import { CheerioAPI, load } from "cheerio/slim";
import { globSync } from "glob";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { cpus } from "node:os";
import { dirname, extname, join } from "node:path";
import { CodecType, ImageWorkerOutputTypes } from "../../lib/types";
import { batchProcess } from "../../lib/utils";
import { Minomax } from "../../minomax";

const minomax = new Minomax();

function _posterExist(posterPath: string): boolean {
	return existsSync(posterPath);
}

function _videoExist(videoUrl: string): boolean {
	return existsSync(videoUrl);
}

function _expectedPosterExtension(
	posterPath: string,
	variableImgFormat: ImageWorkerOutputTypes,
): boolean {
	return extname(posterPath) === `.${variableImgFormat}`;
}

function _expectedVideoExtension(
	videoTag: CheerioAPI | any,
	videoCodec: CodecType,
): [string, boolean] {
	const shallowVideoUrl: string | undefined = videoTag.attr("src");

	const linkInSourceTag: string | undefined = videoTag
		.find("source:first-child")
		.attr("src");

	const videoUrl: string = shallowVideoUrl
		? shallowVideoUrl
		: linkInSourceTag || "not-found";

	const expectedVideoExtension = ["mav1", "mx265"].includes(videoCodec)
		? ".mp4"
		: ".webm";

	return [videoUrl, extname(videoUrl) === expectedVideoExtension];
}

export async function testVideoThumbnailMaker({
	htmlLookupPattern,
	ignorePatterns,
	variableImgFormat,
	videoCodec,
}: {
	htmlLookupPattern: string[];
	ignorePatterns: string[];
	variableImgFormat: ImageWorkerOutputTypes;
	videoCodec: CodecType;
}) {
	const testTriggeredOn = Date.now(); // for file mod filter - cond (1)

	await minomax.makeVideoThumbnail({
		htmlLookupPattern: htmlLookupPattern,
		ignorePatterns: ignorePatterns,
		variableImgFormat: variableImgFormat,
		videoCodec: videoCodec,
	});

	//(1) For file discovery and mod test condition
	const expectedHTMLCount = 3; //hardcoded as per test samples

	const targetedFiles = globSync(htmlLookupPattern, {
		nodir: true,
		ignore: ignorePatterns,
	});

	/*  (2) checks if all video tag passed (4 Conditions):
		Has poster and video link - 2 condition
		Existing with expected type extensions - 2 conditions */
	const multiConditionPromises: (() => Promise<boolean>)[] =
		targetedFiles.map(
			(targetFile) => () =>
				new Promise((resolve, reject) => {
					readFile(targetFile)
						.then((content) => {
							const $ = load(content);

							let passedVideoCount: number = 0;

							const videoTags = $("video");

							videoTags?.each((_idx, elem) => {
								const posterLink: string =
									$(elem).attr("poster") || "not-found";

								const posterRelPath = join(
									dirname(targetFile),
									posterLink,
								);

								const [videoUrl, expectedVideoExtension] =
									_expectedVideoExtension($(elem), videoCodec);

								const videoRelPath = join(dirname(targetFile), videoUrl);

								const allCondition_PASSED =
									_posterExist(posterRelPath) &&
									_videoExist(videoRelPath) &&
									_expectedPosterExtension(
										posterRelPath,
										variableImgFormat,
									) &&
									expectedVideoExtension;

								if (allCondition_PASSED) {
									passedVideoCount += 1;
								}
							});

							const ALL_PASSED = passedVideoCount === videoTags?.length;

							resolve(ALL_PASSED);
						})
						.catch(reject);
				}),
		);

	const posterVideoExistance_imgExt_videoExt_PASSED = (
		await batchProcess({
			promisedProcs: multiConditionPromises,
			batchSize: cpus().length,
			context: "Thumbnail- Multi condition check",
		})
	).every((passed) => passed);

	console.log(
		"Thumbnail Maker - posterVideoExistance_imgExt_videoExt:",
		posterVideoExistance_imgExt_videoExt_PASSED
			? "✅ PASSED"
			: "❌ Failed",
	);

	/*  Check if file modified - pair of condition (1) */
	const updatedFilesCount = targetedFiles.reduce(
		(count, filePath) =>
			count + (statSync(filePath).mtimeMs >= testTriggeredOn ? 1 : 0),
		0,
	);

	const fileUpdateCondition_PASSED =
		updatedFilesCount === expectedHTMLCount;

	console.log(
		"Thumbnail Maker - fileUpdateCondition:",
		fileUpdateCondition_PASSED ? "✅ PASSED" : "❌ Failed",
	);

	const PASSED =
		fileUpdateCondition_PASSED &&
		posterVideoExistance_imgExt_videoExt_PASSED;

	return PASSED;
}
