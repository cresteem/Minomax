import imgDiff from "ffmpeg-image-diff";
import { globSync } from "glob";
import { rmSync } from "node:fs";
import { cpus } from "node:os";
import { basename, dirname, extname, join, relative } from "node:path";
import { ImageWorkerOutputTypes } from "../../lib/types";
import { batchProcess } from "../../lib/utils";
import { Minomax } from "../../minomax";
import { calculateTotalSize } from "./util.base";

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
					console.log("❌ Failed at SSIM", inputPath, ssimScore);
					resolve(false);
				} else {
					resolve(passed);
				}
			})
			.catch(reject);
	});
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

	/* 1)To check if file discovery working propery */
	const expectedImageFileCount = 5; //hardcoded as per test samples

	/* 2) get files list on destination to check output availablity with 3)targetformat */
	const destinatinatedFiles = globSync(
		`${destinationBasePath}/**/*.${targetFormat}`,
		{ nodir: true },
	);
	const destinatinatedFilesCount = destinatinatedFiles.length;

	const fileLookup_destinatedFiles_outputType_PASSED =
		destinatinatedFilesCount === expectedImageFileCount;

	console.log(
		"Image - fileLookup_destinatedFiles_outputType:",
		fileLookup_destinatedFiles_outputType_PASSED
			? "✅ PASSED"
			: "❌ Failed",
	);

	/* 4) Size comparison */
	const oldFiles = globSync(lookUpPatterns, {
		ignore: ignorePatterns,
		nodir: true,
	});
	const oldFilesSize = await calculateTotalSize(oldFiles);
	const destinatinatedFilesSize = await calculateTotalSize(
		destinatinatedFiles,
	);
	const sizeComparison_PASSED = oldFilesSize > destinatinatedFilesSize;

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
		(inputImagePath: string) => () => {
			const outputImagePath = join(
				destinationBasePath,
				`${relative(
					process.cwd(),
					join(
						dirname(inputImagePath),
						basename(inputImagePath, extname(inputImagePath)),
					),
				)}.${targetFormat}`,
			);
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

	//cleanup
	rmSync(destinationBasePath, { recursive: true, force: true });

	const testPassed =
		fileLookup_destinatedFiles_outputType_PASSED &&
		sizeComparison_PASSED &&
		Integrity_PASSED;

	return testPassed;
}
