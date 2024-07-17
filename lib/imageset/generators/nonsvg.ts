import { existsSync } from "fs";
import { copyFile } from "fs/promises";
import { dirname, join, relative } from "path";
import { upscale } from "pixteroid";
import sharp from "sharp";
import configurations from "../../../configLoader";
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
	return new Promise((resolve, reject) => {
		const tempOPFilePath: string = join(
			process.cwd(),
			".pixteroid",
			relative(process.cwd(), baseImage),
		);

		if (!existsSync(tempOPFilePath)) {
			upscale(
				baseImage,
				tempOPFilePath,
				configurations.imageSetConfigurations.upscaleLevel,
			)
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

export default function nonSvgGen(
	baseImagePath: string,
	targetWidth: number,
	destinationPath: string,
): Promise<void> {
	return new Promise((resolve, reject) => {
		/* Get base image width */
		_getImageWidth(baseImagePath)
			.then((baseImageWidth: number) => {
				let upscaledBaseImagePath: string = "";
				let upscaledBaseimageWidth: number = 0;

				if (targetWidth > baseImageWidth) {
					_upscaler(baseImagePath)
						.then((upscaleImageMeta: UpscalerResponse) => {
							upscaledBaseImagePath = upscaleImageMeta.upscaledBaseimage;
							upscaledBaseimageWidth =
								upscaleImageMeta.upscaledBaseimageWidth;

							_gen(
								destinationPath,
								baseImagePath,
								baseImageWidth,
								upscaledBaseImagePath,
								upscaledBaseimageWidth,
								targetWidth,
							)
								.then(resolve)
								.catch(reject);
						})
						.catch((err: Error) => {
							reject(`⚠️ Failed to generate ${baseImagePath}\n${err}`);
						});
				} else {
					_gen(
						destinationPath,
						baseImagePath,
						baseImageWidth,
						upscaledBaseImagePath,
						upscaledBaseimageWidth,
						targetWidth,
					)
						.then(resolve)
						.catch(reject);
				}
			})
			.catch(reject);
	}); //promise ended
}

function _gen(
	destinationPath: string,
	baseImagePath: string,
	baseImageWidth: number,
	upscaledBaseImagePath: string,
	upscaledBaseimageWidth: number,
	targetWidth: number,
): Promise<void> {
	//recursively create hierarchical output directories if not existing
	makeDirf(dirname(destinationPath));

	//Image Resize - block
	const sourceImage = upscaledBaseImagePath
		? upscaledBaseImagePath
		: baseImagePath;

	const sourceImageWidth = upscaledBaseImagePath
		? upscaledBaseimageWidth
		: baseImageWidth;

	return new Promise((resolve, reject) => {
		//check if image is already in expected size and do needed otherwise.
		if (sourceImageWidth !== targetWidth) {
			_resizeImage(sourceImage, destinationPath, targetWidth)
				.then(resolve)
				.catch(reject);
		} else {
			//copy file if not exist
			if (!existsSync(destinationPath)) {
				copyFile(sourceImage, destinationPath).then(resolve).catch(reject);
			}
		}
	});
}
