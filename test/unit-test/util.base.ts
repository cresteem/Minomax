import { stat } from "node:fs/promises";
import { cpus } from "node:os";
import { batchProcess } from "../../lib/utils";

const batchSize = cpus().length;

export async function calculateTotalSize(
	filePaths: string[],
): Promise<number> {
	const fileSizePromises: (() => Promise<number>)[] = filePaths.map(
		(filePath) => () =>
			new Promise((resolve, reject) => {
				stat(filePath)
					.then((stats) => {
						resolve(stats?.size || 0);
					})
					.catch(reject);
			}),
	);

	const fileSizeResponses: Awaited<number[]> = await batchProcess<number>({
		promisedProcs: fileSizePromises,
		batchSize: batchSize,
		context: "Files size calcultion",
	});

	const totalSize = fileSizeResponses.reduce((a, b) => a + b);
	return totalSize;
}
