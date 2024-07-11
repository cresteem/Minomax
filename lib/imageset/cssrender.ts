import puppeteer from "puppeteer";

export async function getImageSize(
	selectors: { id: string; classes: string[] },
	htmlPath: string,
	screenSizes: Record<string, number>,
): Promise<Record<string, number>> {
	// Browser instance
	const browser = await puppeteer.launch({
		headless: "new",
		args: ["--start-maximized"],
	});

	// Page to load
	const page = await browser.newPage();

	const nativeScreenSize = await page.evaluate(() => {
		return {
			height: window.screen.availHeight,
		};
	});

	const imageSizes: Record<string, number> = {};

	for (const screenKey of Object.keys(screenSizes)) {
		// Setting specific width and height for viewport
		await page.setViewport({
			width: screenSizes[screenKey],
			height: nativeScreenSize.height,
		});

		// Navigate to the htmlPath
		await page.goto(htmlPath);

		const selector: string = selectors.id
			? selectors.id
			: selectors.classes
			? selectors.classes[0]
			: "img";

		// Extract the size of the image
		const imageSize = await page.evaluate((selector) => {
			const img: any = document.querySelector(selector);

			return {
				width: img?.width,
				height: img?.height,
			};
		}, selector);

		imageSizes[screenKey] = imageSize as any;
	}

	// Close the browser
	await browser.close();

	return imageSizes;
}
