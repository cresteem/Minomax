import { existsSync } from "fs";
import { copyFile } from "fs/promises";
import { dirname } from "path";
import { makeDirf } from "../../utils";

export default function svgGen(
	baseImagePath: string,
	destinationPath: string,
): Promise<void> {
	return new Promise((complete, reject) => {
		makeDirf(dirname(destinationPath));

		if (!existsSync(destinationPath)) {
			copyFile(baseImagePath, destinationPath)
				.then(() => {
					complete();
				})
				.catch((error: Error) => {
					reject(error);
				});
		} else {
			complete();
		}
	});
}
