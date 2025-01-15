import imgDiff from "ffmpeg-image-diff";
import { globSync } from "glob";
import { cpus } from "node:os";
import { extname } from "node:path";
import { ImageWorkerOutputTypes } from "../../lib/types";
import { batchProcess, calculateTotalSize } from "../../lib/utils";
import { Minomax } from "../../minomax";

const minomax = new Minomax();
const batchSize = cpus().length;

async function _compareImagesSSIM(
	inputPath: string,
	outputPath: string,
): Promise<boolean> {
	return new Promise((resolve, reject) => {
		imgDiff(inputPath, outputPath)
			.then((ssim) => {
				const ssimScore = ssim.All || 0;
				const passed = ssimScore > 0.9;
				if (!passed) {
					console.log(
						"❌ Failed at SSIM",
						"IN:",
						inputPath,
						"OP:",
						outputPath,
						"Score:",
						ssimScore,
						ssim,
					);
					resolve(false);
				} else {
					resolve(passed);
				}
			})
			.catch(reject);
	});
}

export async function imageWorkerTestConditions({
	targetFormat,
	lookUpPatterns = null,
	expectedFileCount,
	ignorePatterns,
	destinationBasePath,
}: {
	targetFormat: ImageWorkerOutputTypes;
	lookUpPatterns?: string[] | null;
	expectedFileCount?: number;
	ignorePatterns: string[];
	destinationBasePath: string;
}): Promise<boolean> {
	/* 1)To check if file discovery working propery */

	const expectedFiles = globSync(lookUpPatterns || [], {
		absolute: true,
		nodir: true,
		ignore: ignorePatterns,
	}).filter((path) => {
		if (targetFormat === "svg") {
			return extname(path) === ".svg";
		} else {
			return [".avif", ".webp", ".jpg", ".png"].includes(extname(path));
		}
	});

	expectedFileCount = expectedFileCount || expectedFiles.length;

	/* 2) get files list on destination to check output availablity with 3)targetformat */
	const destinatinatedFiles = globSync(
		[`**/*.${targetFormat}`, `**/*.svg`],
		{
			nodir: true,
			absolute: true,
			cwd: destinationBasePath,
		},
	);
	const destinatinatedFilesCount = destinatinatedFiles.length;

	/* writeFileSync(
		"imgw.log.txt",
		JSON.stringify(
			{ lookUpPatterns, expectedFiles, destinatinatedFiles },
			null,
			2,
		),
		{ encoding: "utf8" },
	); */

	const fileLookup_destinatedFiles_outputType_PASSED =
		destinatinatedFilesCount === expectedFileCount;

	console.log(
		"Image - fileLookup_destinatedFiles_outputType:",
		fileLookup_destinatedFiles_outputType_PASSED
			? "✅ PASSED"
			: "❌ Failed",
	);

	/* 4) Size comparison */
	const adaptivePattern =
		lookUpPatterns ||
		destinatinatedFiles; /* compare with same file if run main tc */

	const oldFiles = globSync(adaptivePattern, {
		ignore: ignorePatterns,
		nodir: true,
	});
	const oldFilesSize = await calculateTotalSize(oldFiles);
	const destinatinatedFilesSize = await calculateTotalSize(
		destinatinatedFiles,
	);
	const sizeComparison_PASSED =
		Boolean(expectedFileCount) || oldFilesSize > destinatinatedFilesSize;

	console.log(
		"Image sizeComparison:",
		sizeComparison_PASSED ? "✅ PASSED" : "❌ Failed",
	);
	console.log(
		"🚀 Image File Sizes reduced by",
		100 - (destinatinatedFilesSize / oldFilesSize) * 100,
		"%",
	);

	/* 5) File integrity test  */
	const integrityPromises = oldFiles.map(
		(inputImagePath: string, idx) => () => {
			const outputImagePath = destinatinatedFiles[idx];
			return _compareImagesSSIM(inputImagePath, outputImagePath);
		},
	);

	const integrityResponses = await batchProcess({
		promisedProcs: integrityPromises,
		batchSize: batchSize,
		context: "Check Image Integrity",
	});

	const Integrity_PASSED = integrityResponses.every((passed) => passed);

	console.log(
		"Image Integrity:",
		Integrity_PASSED ? "✅ PASSED" : "❌ Failed",
	);

	const testPassed =
		fileLookup_destinatedFiles_outputType_PASSED &&
		sizeComparison_PASSED &&
		Integrity_PASSED;

	return testPassed;
}

export async function testCompressImages({
	targetFormat,
	lookUpPatterns,
	ignorePatterns,
	destinationBasePath,
}: {
	targetFormat: ImageWorkerOutputTypes;
	lookUpPatterns: string[];
	ignorePatterns: string[];
	destinationBasePath: string;
}) {
	await minomax.compressImages({
		targetFormat: targetFormat,
		lookUpPatterns: lookUpPatterns,
		ignorePatterns: ignorePatterns,
		destinationBasePath: destinationBasePath,
	});

	return await imageWorkerTestConditions({
		targetFormat: targetFormat,
		lookUpPatterns: lookUpPatterns,
		ignorePatterns: ignorePatterns,
		destinationBasePath: destinationBasePath,
	});
}
