import puppeteer, { Browser } from "puppeteer";

export function getImageSize(
	selectors: { id: string; classes: string[] },
	htmlPath: string,
	screenSizes: Record<string, number>,
): Promise<Record<string, number>> {
	/* let prevsec: number = new Date().getTime(); */

	return new Promise(async (complete, incomplete) => {
		let browser: Browser = {} as Browser;

		try {
			// Browser instance
			browser = await puppeteer.launch({
				headless: true,
				args: ["--start-maximized"],
			});

			const imageSizes: Record<string, number> = {};

			const promises: (() => Promise<void>)[] = Object.keys(
				screenSizes,
			).map((screenKey) => {
				return (): Promise<void> => {
					return new Promise(async (resolve, reject) => {
						try {
							const page = await browser.newPage();
							const nativeScreenSize = await page.evaluate(() => ({
								height: window.screen.availHeight,
							}));

							await page.setViewport({
								width: screenSizes[screenKey],
								height: nativeScreenSize.height,
							});

							await page.goto(htmlPath, { timeout: 60000 });

							const selector: string =
								selectors?.id || selectors?.classes[0] || "img";

							const imageSize = await page.evaluate((selector: string) => {
								const img: any = document.querySelector(selector);

								return {
									width: img?.width,
									// height: img?.height,
								};
							}, selector);

							imageSizes[screenKey] = imageSize as any;
							await page.close();
							resolve();
						} catch (err) {
							reject(err);
						}
					});
				};
			});

			/*  */
			/* Batching promises */
			const batchSize: number = 1;
			const promiseBatches: (() => Promise<void>)[][] = [];

			for (let i = 0; i < promises.length; i += batchSize) {
				promiseBatches.push(promises.slice(i, i + batchSize));
			}

			/* Activating batches */
			for (const batch of promiseBatches) {
				const activatedBatch: Promise<void>[] = batch.map((func) =>
					func(),
				);

				try {
					await Promise.all(activatedBatch);
				} catch (err) {
					console.log(err);
				}
			}

			/* const ctime = new Date().getTime();
			console.log(Math.floor(ctime - prevsec));
			prevsec = ctime; */

			complete(imageSizes);
		} catch (err) {
			incomplete(err);
		} finally {
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
	});
}
