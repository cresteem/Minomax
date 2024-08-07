import { mkdirSync } from "fs";
import { copyFile, writeFile } from "fs/promises";
import { freemem } from "os";
import { dirname, join, relative } from "path";

export function makeDirf(dirPath: string): void {
	mkdirSync(dirPath, { recursive: true });
}

export function currentTime(): string {
	const currentDate = new Date();
	return `${currentDate.getHours()}:${currentDate.getMinutes()}:${currentDate.getSeconds()}`;
}

export function allocateBatchSize(perProcMem: number) {
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
	const batchSize: number = allocateBatchSize(100);

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
