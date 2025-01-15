/* Integration Test */

import { globSync } from "glob";
import { rm } from "node:fs/promises";
import { extname, relative, sep } from "node:path";
import {
	ImageWorkerParamsMain,
	VideoWorkerParamsMain,
} from "../lib/types";
import { Minomax } from "../minomax";
import { imageWorkerTestConditions } from "./unit-test/util.compress-images";
import { videoWorkerTestConditions } from "./unit-test/util.compress-videos";
import { imageSetTestConditions } from "./unit-test/util.imageset";
import { videoThumnailGenTestConditions } from "./unit-test/util.video-thumbnail";
import { webdocTestConditions } from "./unit-test/util.webdoc";

const minomax = new Minomax();

async function _integrationTest({
	imageWorkerParams,
	videoWorkerParams,
	ignorePatterns,
	webDocLookUpPatterns,
	destinationBasePath,
}: {
	imageWorkerParams: ImageWorkerParamsMain;
	videoWorkerParams: VideoWorkerParamsMain;
	ignorePatterns: string[];
	webDocLookUpPatterns: string[];
	destinationBasePath: string;
}): Promise<boolean> {
	const testTriggeredOn = Date.now(); // for file mod filter - cond (1) - thumbnailgenerator

	const { availableImages, availableVideos, thumnailCount } =
		await minomax.minomax({
			imageWorkerParams: imageWorkerParams,
			videoWorkerParams: videoWorkerParams,
			ignorePatterns: ignorePatterns,
			webDocLookUpPatterns: webDocLookUpPatterns,
			destinationBasePath: destinationBasePath,
		});

	//1) copy test
	const availableFilesInDest = globSync(webDocLookUpPatterns, {
		cwd: destinationBasePath,
		absolute: true,
		nodir: true,
	});

	const expectedFileCount = 8; //manual definition as per available test samples

	const copyTest_PASSED =
		availableFilesInDest.length === expectedFileCount;

	console.log(
		"main - copyTest:",
		copyTest_PASSED ? "✅ PASSED" : "❌ Failed",
	);

	const sourceHtmlFiles = availableFilesInDest
		.filter((path) => extname(path) === ".html")
		.map((path) =>
			relative(destinationBasePath, path).replaceAll(sep, "/"),
		);

	const imageSet_PASSED = await imageSetTestConditions({
		lookUpPatterns: sourceHtmlFiles,
		destinationBasePath: destinationBasePath,
		ignorePatterns: ignorePatterns,
		vidThumbnailCount: thumnailCount,
	});

	console.log(
		"main - imageSet:",
		imageSet_PASSED ? "✅ PASSED" : "❌ Failed",
	);

	const imageWorker_PASSED = await imageWorkerTestConditions({
		targetFormat: imageWorkerParams.targetFormat,
		expectedFileCount: availableImages.length,
		ignorePatterns: ignorePatterns,
		destinationBasePath: destinationBasePath,
	});

	console.log(
		"main - imageWorker:",
		imageWorker_PASSED ? "✅ PASSED" : "❌ Failed",
	);

	const videoWorker_PASSED = await videoWorkerTestConditions({
		codecType: videoWorkerParams.codecType,
		lookUpPatterns: availableVideos.map((path) =>
			path.replaceAll(sep, "/"),
		),
		expectedVideoFileCount: availableVideos.length,
		ignorePatterns: ignorePatterns,
		destinationBasePath: destinationBasePath,
	});

	console.log(
		"main - videoWorker:",
		videoWorker_PASSED ? "✅ PASSED" : "❌ Failed",
	);

	const videoThumbnailGen_PASSED = await videoThumnailGenTestConditions({
		htmlLookupPattern: webDocLookUpPatterns
			.filter((path) => path.endsWith("html"))
			.map((path) => `${destinationBasePath}/${path}`),
		ignorePatterns: ignorePatterns,
		variableImgFormat: imageWorkerParams.targetFormat,
		videoCodec: videoWorkerParams.codecType,
		testTriggeredOn: testTriggeredOn,
	});

	console.log(
		"main - videoThumnailGen:",
		videoThumbnailGen_PASSED ? "✅ PASSED" : "❌ Failed",
	);

	const webdocWorker_PASSED = await webdocTestConditions({
		lookUpPatterns: webDocLookUpPatterns,
		lookUpBasePath: process.cwd(),
		ignorePatterns: ignorePatterns,
		destinationBasePath: destinationBasePath,
		transformedHtml: true,
	});

	console.log(
		"main - webdocWorker:",
		webdocWorker_PASSED ? "✅ PASSED" : "❌ Failed",
	);

	const PASSED =
		copyTest_PASSED &&
		imageSet_PASSED &&
		imageWorker_PASSED &&
		videoWorker_PASSED &&
		videoThumbnailGen_PASSED &&
		webdocWorker_PASSED;

	return PASSED;
}

const imageWorkerParams: ImageWorkerParamsMain = { targetFormat: "webp" };
const videoWorkerParams: VideoWorkerParamsMain = {
	codecType: "mx265",
	encodeLevel: 1,
};
const ignorePatterns = ["samples/webdocs/mangler-testset/HTML.html"];
const webDocLookUpPatterns = ["**/*.css", "**/*.js", "**/*.html"];
const destinationBasePath = "./temp-artifacts/main";

beforeAll(() => {
	process.chdir(__dirname);
});

test("Integration Test", async () => {
	expect(
		await _integrationTest({
			imageWorkerParams: imageWorkerParams,
			videoWorkerParams: videoWorkerParams,
			ignorePatterns: ignorePatterns,
			webDocLookUpPatterns: webDocLookUpPatterns,
			destinationBasePath: destinationBasePath,
		}),
	).toBe(true);
}, 180000);

afterAll(() => {
	rm(destinationBasePath, { force: true, recursive: true });
});
