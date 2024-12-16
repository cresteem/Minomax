import { existsSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import { upscale } from "pixteroid";
import sharp from "sharp";

import {
	ImageSetConfigurations,
	UpscaleLevels,
	UpscalerResponse,
} from "../../../../types";
import { makeDirf } from "../../../../utils";

export default class RasterisedImageSetGenerator {
	#upscaleLevel: UpscaleLevels;

	constructor({
		baseImagePath,
		targetWidth,
		destinationPath,
		imageSetConfigurations,
	}: {
		baseImagePath: string;
		targetWidth: number;
		destinationPath: string;
		imageSetConfigurations: ImageSetConfigurations;
	}) {
		const { upscaleLevel } = imageSetConfigurations;

		this.#upscaleLevel = upscaleLevel;

		this.#main({ baseImagePath, targetWidth, destinationPath });
	}

	#_getImageWidth(imagePath: string): Promise<number> {
		return new Promise((resolve, reject) => {
			sharp(imagePath)
				.metadata()
				.then((meta) => {
					resolve(meta.width || 0);
				})
				.catch((err) => {
					reject(`Error getting image width, at ${imagePath}\n${err}`);
				});
		});
	}

	#_resizeImage({
		sourceImage,
		outputImagePath,
		targetImageWidth,
	}: {
		sourceImage: string;
		outputImagePath: string;
		targetImageWidth: number;
	}): Promise<void> {
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
				.catch((err) => {
					reject(`Error resizing image, at ${sourceImage}\n${err}`);
				});
		});
	}

	#_upscaler(baseImage: string): Promise<UpscalerResponse> {
		return new Promise((resolve, reject) => {
			const tempOPFilePath: string = join(
				process.cwd(),
				".pixteroid",
				relative(process.cwd(), baseImage),
			);

			// Condition to use if same image already upscaled
			if (!existsSync(tempOPFilePath)) {
				upscale(baseImage, tempOPFilePath, this.#upscaleLevel)
					.then(() => {
						this.#_getImageWidth(tempOPFilePath)
							.then((width: number) => {
								resolve({
									upscaledBaseimage: tempOPFilePath,
									upscaledBaseimageWidth: width,
								});
							})
							.catch(reject);
					})
					.catch((err) => {
						reject(`Error while upscaling image, at ${baseImage}\n${err}`);
					});
			} else {
				this.#_getImageWidth(tempOPFilePath)
					.then((width: number) => {
						resolve({
							upscaledBaseimage: tempOPFilePath,
							upscaledBaseimageWidth: width,
						});
					})
					.catch(reject);
			}
		});
	}

	#_generate({
		destinationPath,
		baseImagePath,
		baseImageWidth,
		targetWidth,
	}: {
		destinationPath: string;
		baseImagePath: string;
		baseImageWidth: number;
		targetWidth: number;
	}): Promise<void> {
		//recursively create hierarchical output directories if not existing
		makeDirf(dirname(destinationPath));

		return new Promise((resolve, reject) => {
			//check if image is already in expected size and resize otherwise.
			if (baseImageWidth !== targetWidth) {
				this.#_resizeImage({
					sourceImage: baseImagePath,
					outputImagePath: destinationPath,
					targetImageWidth: targetWidth,
				})
					.then(resolve)
					.catch((err) => {
						reject(
							`Error while generating a image of ${targetWidth}, at ${baseImagePath}\n${err}`,
						);
					});
			} else {
				//This block meant to execute source image width and target image width are equal.

				//copy file if not exist
				if (!existsSync(destinationPath)) {
					copyFile(baseImagePath, destinationPath)
						.then(resolve)
						.catch((err) => {
							reject(
								`Error while generating a image of ${targetWidth}, at ${baseImagePath}\n${err}`,
							);
						});
				}
			}
		});
	}

	#main({
		baseImagePath,
		targetWidth,
		destinationPath,
	}: {
		baseImagePath: string;
		targetWidth: number;
		destinationPath: string;
	}): Promise<void> {
		return new Promise((resolve, reject) => {
			/* Get base image width */
			this.#_getImageWidth(baseImagePath)
				.then((baseImageWidth: number) => {
					//Upscale the image if it is smaller than target.
					if (targetWidth > baseImageWidth) {
						this.#_upscaler(baseImagePath)
							.then((upscaleImageMeta: UpscalerResponse) => {
								//Generate image with upscaled image
								this.#_generate({
									destinationPath: destinationPath,
									baseImagePath: upscaleImageMeta.upscaledBaseimage,
									baseImageWidth: upscaleImageMeta.upscaledBaseimageWidth,
									targetWidth: targetWidth,
								})
									.then(resolve)
									.catch(reject);
							})
							.catch(reject);
					} else {
						this.#_generate({
							destinationPath: destinationPath,
							baseImagePath: baseImagePath,
							baseImageWidth: baseImageWidth,
							targetWidth: targetWidth,
						})
							.then(resolve)
							.catch(reject);
					}
				})
				.catch(reject);
		}); //promise ended
	}
}
