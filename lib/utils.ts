import { mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import { freemem } from "os";
import { dirname } from "path";

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
