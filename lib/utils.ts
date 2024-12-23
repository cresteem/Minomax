import { greenBright, red, yellowBright } from "ansi-colors";
import { Presets, SingleBar } from "cli-progress";
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

export function terminate({ reason }: { reason: string }): void {
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

export function calculateBatchSize({
	perProcMem,
}: {
	perProcMem: number;
}) {
	const freememInMB: number = Math.floor(freemem() / 1024 / 1024);
	const batchSize: number = Math.round(freememInMB / perProcMem);
	return batchSize;
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
) {
	const batchSize: number = calculateBatchSize({ perProcMem: 100 });

	const promises: (() => Promise<void>)[] = [];

	filePaths.forEach((filePath: string) => {
		promises.push((): Promise<void> => {
			return new Promise((resolve, reject) => {
				const destPath: string = join(
					destinationBasePath,
					relative(process.cwd(), filePath),
				);

				makeDirf(dirname(destPath));

				copyFile(filePath, destPath).then(resolve).catch(reject);
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

		try {
			await Promise.all(activatedBatch);
		} catch (err) {
			console.log(err);
		}
	}
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
					relative(".", logPath),
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
