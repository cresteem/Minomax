import puppeteer from "puppeteer";

export async function getImageSize(
	selectors: { id: string; classes: string[] },
	htmlPath: string,
	screenSizes: Record<string, number>,
): Promise<Record<string, number>> {
	return new Promise((resolve, reject) => {
		// Browser instance
		puppeteer
			.launch({
				headless: true,
				args: ["--start-maximized"],
			})
			.then(async (browser) => {
				const imageSizes: Record<string, number> = {};

				const promises = [];

				for (const screenKey of Object.keys(screenSizes)) {
					promises.push((): Promise<void> => {
						return new Promise((resolve, reject) => {
							// Page to load
							browser
								.newPage()
								.then((page) => {
									page
										.evaluate(() => {
											return {
												height: window.screen.availHeight,
											};
										})
										.then((nativeScreenSize) => {
											// Setting specific width and height for viewport
											page
												.setViewport({
													width: screenSizes[screenKey],
													height: nativeScreenSize.height,
												})
												.then(() => {
													// Navigate to the htmlPath
													page
														.goto(htmlPath)
														.then(() => {
															const selector: string =
																selectors?.id ||
																selectors?.classes[0] ||
																"img";

															// Extract the size of the image
															page
																.evaluate((selector) => {
																	const img: any =
																		document.querySelector(selector);

																	return {
																		width: img?.width,
																		/* height: img?.height, */
																	};
																}, selector)
																.then((imageSize) => {
																	imageSizes[screenKey] = imageSize as any;
																	resolve();
																})
																.catch(reject);
														})
														.catch(reject);
												})
												.catch(reject);
										})
										.catch(reject);
								})
								.catch(reject);
						});
					});
				}

				/*  */
				Promise.all(
					promises.map((func) => {
						func();
					}),
				)
					.then(() => {
						// Close the browser
						browser.close().catch((err: Error) => {
							console.log(err);
						});
						resolve(imageSizes);
					})
					.catch(reject);
				/*  */
			})
			.catch(reject);
	});
}
