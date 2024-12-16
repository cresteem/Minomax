import { existsSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { dirname } from "node:path";
import { makeDirf } from "../../../../utils";

export default function svgGen({
	baseImagePath,
	destinationPath,
}: {
	baseImagePath: string;
	destinationPath: string;
}): Promise<void> {
	return new Promise((resolve, reject) => {
		makeDirf(dirname(destinationPath));

		if (!existsSync(destinationPath)) {
			copyFile(baseImagePath, destinationPath)
				.then(() => {
					resolve();
				})
				.catch((error: Error) => {
					reject("Error copying svg file\n" + error);
				});
		} else {
			resolve();
		}
	});
}
