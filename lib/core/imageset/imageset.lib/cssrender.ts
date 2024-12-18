import puppeteer, { type Browser, Page } from "puppeteer";
import { ImageSizeResponse } from "../../../types";
import { terminate } from "../../../utils";

async function _closeBrowser(browser: Browser) {
	if (browser) {
		try {
			// Adding a slight delay before closing the browser
			await new Promise((resolve) => setTimeout(resolve, 1000));
			await browser.close();
		} catch (err) {
			console.error("Error closing browser:", err);
		}
	}
}

function _getImageSize({
	page,
	screenKey,
	screenWidth,
	selector,
}: {
	page: Page;
	screenKey: string;
	screenWidth: number;
	selector: string;
}): Promise<ImageSizeResponse> {
	return new Promise(async (resolve, reject) => {
		try {
			await page.setViewport({
				width: screenWidth,
				height: 780,
			});

			const imageSize = await page.evaluate((selector: string) => {
				const img: any = document.querySelector(selector);

				return {
					width: img?.width,
					// height: img?.height,
				};
			}, selector);

			const result: Record<string, { width: number; height?: number }> =
				{};
			result[screenKey] = imageSize;

			resolve(result);
		} catch (err) {
			reject(`Error calculating image size, at ${selector}\n${err}`);
		}
	});
}

export function getImageSizes(
	selectors: { id: string | undefined; classes: string[] },
	htmlPath: string,
	screenSizes: Record<string, number>,
): Promise<ImageSizeResponse> {
	const selector: string = selectors?.id || selectors?.classes[0] || "img";

	return new Promise(async (resolve, reject) => {
		let browser: Browser = {} as Browser;

		try {
			// Browser instance
			browser = await puppeteer.launch({
				headless: true,
				args: ["--start-maximized"],
			});
		} catch (err) {
			terminate({ reason: `Failed to launch browser, ${err}` });
		}

		try {
			const page = await browser.newPage();

			await page.goto(htmlPath, { timeout: 60000 });

			const imageSizes: ImageSizeResponse = {};

			const promises: (() => Promise<ImageSizeResponse>)[] = Object.keys(
				screenSizes,
			).map(
				(screenKey: string) => (): Promise<ImageSizeResponse> =>
					_getImageSize({
						page: page,
						screenKey: screenKey,
						screenWidth: screenSizes[screenKey],
						selector: selector,
					}),
			);

			/* Activating promise */
			for (const promise of promises) {
				try {
					const resolvedImageSize = await promise();
					Object.assign(imageSizes, resolvedImageSize);
				} catch (err) {
					console.log(err);
				}
			}

			_closeBrowser(browser);
			resolve(imageSizes);
		} catch (err) {
			_closeBrowser(browser);
			reject(err);
		}
	});
}
