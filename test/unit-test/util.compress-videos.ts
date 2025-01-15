import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import ffmpeg from "fluent-ffmpeg";
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

import { globSync } from "glob";
import { cpus } from "node:os";
import { basename, dirname, extname, join, relative } from "node:path";
import { CodecType, VideoEncodeLevels } from "../../lib/types";

import { batchProcess, calculateTotalSize } from "../../lib/utils";
import { Minomax } from "../../minomax";

const minomax = new Minomax();
const batchSize = cpus().length;

function _getVideoDurations(videoPath: string): Promise<number> {
	return new Promise((resolve, reject) => {
		ffmpeg.ffprobe(videoPath, (err, inputMeta) => {
			if (err) {
				reject(err);
			}

			const inputDurations = inputMeta?.format?.duration || 0;

			if (!inputDurations) {
				reject("invalid duration");
			} else {
				resolve(inputDurations);
			}
		});
	});
}

function _compareVideoDuration(
	inputPath: string,
	outputPath: string,
): Promise<boolean> {
	return new Promise((resolve, reject) => {
		_getVideoDurations(inputPath)
			.then((inputDurations) => {
				_getVideoDurations(outputPath)
					.then((outputDurations) => {
						resolve(inputDurations === outputDurations);
					})
					.catch(reject);
			})
			.catch(reject);
	});
}

export async function videoWorkerTestConditions({
	codecType,
	lookUpPatterns,
	ignorePatterns,
	destinationBasePath,
	expectedVideoFileCount,
}: {
	codecType: CodecType;
	lookUpPatterns: string[];
	ignorePatterns: string[];
	destinationBasePath: string;
	expectedVideoFileCount?: number;
}): Promise<boolean> {
	/* 1) To check if file discovery working propery */
	/* expectedVideoFileCount; */
	const oldFiles = globSync(lookUpPatterns, {
		ignore: ignorePatterns,
		nodir: true,
		absolute: true,
	});

	expectedVideoFileCount = expectedVideoFileCount || oldFiles.length;

	/* 2) get files list on destination to check output availablity with 3)targetformat */
	const targetFormat = ["mav1", "mx265"].includes(codecType)
		? "mp4"
		: "webm";
	const destinatinatedFiles = globSync(`**/*.${targetFormat}`, {
		nodir: true,
		cwd: destinationBasePath,
		absolute: true,
	});

	const destinatinatedFilesCount = destinatinatedFiles.length;

	const fileLookup_destinatedFiles_outputType_PASSED =
		destinatinatedFilesCount === expectedVideoFileCount;

	console.log(
		"Video - fileLookup_destinatedFiles_outputType:",
		fileLookup_destinatedFiles_outputType_PASSED
			? "✅ PASSED"
			: "❌ Failed",
	);

	/* 4) Size comparison */

	const oldFilesSize = await calculateTotalSize(oldFiles);
	const destinatinatedFilesSize = await calculateTotalSize(
		destinatinatedFiles,
	);
	/* console.debug(
		oldFiles,
		destinatinatedFiles,
		oldFilesSize,
		destinatinatedFilesSize,
	); */
	const sizeComparison_PASSED = oldFilesSize > destinatinatedFilesSize;

	/* writeFileSync(
		"cvid.log.txt",
		JSON.stringify(
			{ lookUpPatterns, oldFiles, destinatinatedFiles },
			null,
			3,
		),
	); */

	console.log(
		"Video sizeComparison:",
		sizeComparison_PASSED ? "✅ PASSED" : "❌ Failed",
	);
	console.log(
		"🚀 Video File Sizes reduced by",
		100 - (destinatinatedFilesSize / oldFilesSize) * 100,
		"%",
	);

	/* 5) File integrity test  */
	const integrityPromises = oldFiles.map(
		(inputVidoePath: string) => () => {
			const outputVideoPath = join(
				destinationBasePath,
				`${relative(
					process.cwd(),
					join(
						dirname(inputVidoePath),
						basename(inputVidoePath, extname(inputVidoePath)),
					),
				)}.${targetFormat}`,
			);
			return _compareVideoDuration(inputVidoePath, outputVideoPath);
		},
	);

	const integrityResponses = await batchProcess({
		promisedProcs: integrityPromises,
		batchSize: batchSize,
		context: "Check Video Integrity",
	});

	const Integrity_PASSED = integrityResponses.every((passed) => passed);

	console.log(
		"Video Integrity:",
		Integrity_PASSED ? "✅ PASSED" : "❌ Failed",
	);

	const testPassed =
		fileLookup_destinatedFiles_outputType_PASSED &&
		sizeComparison_PASSED &&
		Integrity_PASSED;
	return testPassed;
}

export async function testCompressVideos({
	codecType,
	encodeLevel,
	lookUpPatterns,
	ignorePatterns,
	destinationBasePath,
}: {
	codecType: CodecType;
	encodeLevel: VideoEncodeLevels;
	lookUpPatterns: string[];
	ignorePatterns: string[];
	destinationBasePath: string;
}) {
	await minomax.compressVideos({
		codecType: codecType,
		encodeLevel: encodeLevel,
		lookUpPatterns: lookUpPatterns,
		ignorePatterns: ignorePatterns,
		destinationBasePath: destinationBasePath,
	});

	return await videoWorkerTestConditions({
		codecType: codecType,
		lookUpPatterns: lookUpPatterns,
		ignorePatterns: ignorePatterns,
		destinationBasePath: destinationBasePath,
		expectedVideoFileCount: 1,
	});
}
