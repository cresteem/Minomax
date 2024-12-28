import { greenBright, red, yellowBright } from "ansi-colors";
import { Presets, SingleBar } from "cli-progress";
import { glob } from "glob";
import {
	appendFileSync,
	existsSync,
	mkdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { copyFile, writeFile } from "node:fs/promises";
import { freemem } from "node:os";
import { dirname, join, relative } from "node:path";

export function terminate({ reason }: { reason: string }): never {
	console.error(reason);
	process.exit(1);
}

export function makeDirf(dirPath: string): void {
	try {
		mkdirSync(dirPath, { recursive: true });
	} catch (err) {
		terminate({ reason: `Error making directory\n${err}` });
	}
}

export function currentTime(): string {
	const currentDate = new Date();
	return `${currentDate.getHours()}:${currentDate.getMinutes()}:${currentDate.getSeconds()}`;
}

export function getFreeMemBatchSize({
	memPerProc,
	cPerBatchSize,
}: {
	memPerProc: number;
	cPerBatchSize: number;
}) {
	const freememInMB: number = Math.floor(freemem() / 1024 / 1024);
	const freeMemBatchSize: number = Math.round(freememInMB / memPerProc);
	return Math.min(freeMemBatchSize, cPerBatchSize);
}

export function writeContent(
	content: string,
	destinationPath: string,
): Promise<void> {
	return new Promise((resolve, reject) => {
		makeDirf(dirname(destinationPath));

		writeFile(destinationPath, content, { encoding: "utf8" })
			.then(() => {
				resolve();
			})
			.catch((err) => {
				reject(err);
			});
	});
}

export async function copyFiles(
	filePaths: string[],
	destinationBasePath: string,
	batchSize: number,
) {
	const copyPromises: (() => Promise<void>)[] = filePaths.map(
		(filePath: string) => () =>
			new Promise((resolve, reject) => {
				const destPath: string = join(
					destinationBasePath,
					relative(process.cwd(), filePath),
				);

				makeDirf(dirname(destPath));

				copyFile(filePath, destPath).then(resolve).catch(reject);
			}),
	);

	await batchProcess({
		promisedProcs: copyPromises,
		batchSize: batchSize,
		context: "Copying Files",
	});
}

const logPath = join(process.cwd(), "minomax.err.log");

export function logWriter(logMessage: string): void {
	appendFileSync(logPath, `[${currentTime()}]: ${logMessage}\n`);
}

export function deleteOldLogs(): void {
	rmSync(logPath, { recursive: true, force: true });
}

export function logNotifier(): void {
	if (existsSync(logPath)) {
		console.log(
			red(
				`\nCheck ${greenBright.bold(
					relative(process.cwd(), logPath),
				)}, for passive ⚠️\twarnings and ❌ errors`,
			),
		);
	}
}

export async function batchProcess<T>({
	promisedProcs,
	batchSize,
	context,
}: {
	promisedProcs: (() => Promise<T>)[];
	batchSize: number;
	context: string;
}): Promise<T[]> {
	const results: T[] = [];

	/* Batching promises */
	const promiseBatches: (() => Promise<T>)[][] = [];

	for (let i = 0; i < promisedProcs.length; i += batchSize) {
		promiseBatches.push(promisedProcs.slice(i, i + batchSize));
	}

	/* Activating batches */
	for (const batch of promiseBatches) {
		const activatedBatch: Promise<T>[] = batch.map((func) => func());

		try {
			const responses = await Promise.all(activatedBatch);
			if (responses) {
				results.push(...responses);
			}
		} catch (err) {
			terminate({
				reason: `Batch process failed at ${context}\n ${err}`,
			});
		}
	}

	return results;
}

export function initProgressBar({
	context = false,
}: {
	context?: false | string;
}) {
	return new SingleBar(
		{
			format: `${
				context ? yellowBright.bold(context + ": ") : ""
			}${yellowBright(
				"{bar}",
			)} {percentage}% | {value} of {total} ✅ | ⌛ Elapsed:{duration}s - ETA:{eta}s`,
			hideCursor: true,
		},
		Presets.shades_classic,
	);
}

export function dumpRunTimeData({
	data,
	context,
	stopAfter = false,
}: {
	data: any;
	context: string;
	stopAfter?: boolean;
}) {
	try {
		writeFileSync(
			`${context.replaceAll(" ", "_").toLowerCase()}.json`,
			JSON.stringify(data, null, 2),
			{
				encoding: "utf-8",
			},
		);
		if (stopAfter) {
			console.log("Stopping program after", context);
			process.exit(0);
		}
	} catch (err) {
		console.error("Error dumping runtime data for", context);
	}
}

export function getAvailableFiles({
	lookUpPattern,
	context,
	ignorePattern = [],
	basePath = process.cwd(),
}: {
	lookUpPattern: string[];
	context: string;
	ignorePattern?: string[];
	basePath?: string;
}): Promise<string[]> {
	ignorePattern = Array.from(
		new Set([...ignorePattern, "node_modules/**"]),
	);

	return new Promise((resolve, reject) => {
		glob(lookUpPattern, {
			ignore: ignorePattern,
			cwd: basePath,
			absolute: true,
			nodir: true,
		})
			.then(resolve)
			.catch((err) => {
				reject(
					`Error getting available files, Context: ${context}\n ${err}`,
				);
			});
	});
}
