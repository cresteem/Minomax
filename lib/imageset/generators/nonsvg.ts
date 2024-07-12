import { existsSync } from "fs";
import { copyFile } from "fs/promises";
import { dirname, join, relative } from "path";
import { upscale } from "pixteroid";
import sharp from "sharp";
import { UpscalerResponse } from "../../options";
import { makeDirf } from "../../utils";

function _getImageWidth(imagePath: string): Promise<number> {
	return new Promise((resolve, reject) => {
		sharp(imagePath)
			.metadata()
			.then((meta) => {
				resolve(meta.width ?? 0);
			})
			.catch(reject);
	});
}

function _resizeImage(
	sourceImage: string,
	outputImagePath: string,
	targetImageWidth: number,
): Promise<void> {
	return new Promise((resolve, reject) => {
		//resize image
		sharp(sourceImage)
			.resize(targetImageWidth, null, {
				kernel: sharp.kernel.lanczos3,
			})
			.toFile(outputImagePath)
			.then(() => {
				resolve();
			})
			.catch(reject);
	});
}

function _upscaler(baseImage: string): Promise<UpscalerResponse> {
	return new Promise(async (resolve, reject) => {
		const tempOPFilePath: string = join(
			process.cwd(),
			".pixteroid",
			relative(process.cwd(), baseImage),
		);

		if (!existsSync(tempOPFilePath)) {
			upscale(baseImage, tempOPFilePath, "level2")
				.then(() => {
					_getImageWidth(tempOPFilePath)
						.then((width) => {
							resolve({
								upscaledBaseimage: tempOPFilePath,
								upscaledBaseimageWidth: width,
							});
						})
						.catch(reject);
				})
				.catch(reject);
		} else {
			_getImageWidth(tempOPFilePath)
				.then((width) => {
					resolve({
						upscaledBaseimage: tempOPFilePath,
						upscaledBaseimageWidth: width,
					});
				})
				.catch(reject);
		}
	});
}

export default async function nonSvgGen(
	baseImagePath: string,
	targetWidth: number,
	destinationPath: string,
): Promise<void> {
	/* Get base image width */
	const baseImageWidth: number = await _getImageWidth(baseImagePath);

	return new Promise(async (resolve, reject) => {
		let upscaledBaseImagePath: string = "";
		let upscaledBaseimageWidth: number = 0;

		if (targetWidth > baseImageWidth) {
			try {
				const upscaleImageMeta: UpscalerResponse = await _upscaler(
					baseImagePath,
				);
				upscaledBaseImagePath = upscaleImageMeta.upscaledBaseimage;
				upscaledBaseimageWidth = upscaleImageMeta.upscaledBaseimageWidth;
			} catch (err) {
				reject(`⚠️ Failed to generate ${baseImagePath}\n${err}`);
			}
		}

		//recursively create hierarchical output directories if not existing
		makeDirf(dirname(destinationPath));

		//Image Resize - block
		const sourceImage = upscaledBaseImagePath
			? upscaledBaseImagePath
			: baseImagePath;

		const sourceImageWidth = upscaledBaseImagePath
			? upscaledBaseimageWidth
			: baseImageWidth;

		//check if image is already in expected size and do needed otherwise.
		if (sourceImageWidth !== targetWidth) {
			try {
				await _resizeImage(sourceImage, destinationPath, targetWidth);
				resolve();
			} catch (err) {
				reject(err);
			}
		} else {
			//copy file if not exist
			if (!existsSync(destinationPath)) {
				try {
					await copyFile(sourceImage, destinationPath);
					resolve();
				} catch (err) {
					reject(err);
				}
			}
		}
	}); //promise ended
}
