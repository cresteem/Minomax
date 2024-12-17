import { minify as HTMLminify } from "html-minifier";
import { transform as lightningcss } from "lightningcss";

import { readFile, writeFile } from "node:fs/promises";
import { HtmlOptions } from "../../types";

export default class Minifier {
	#htmloptions: HtmlOptions;

	constructor({ htmloptions }: { htmloptions: HtmlOptions }) {
		this.#htmloptions = htmloptions;
	}

	#_minifyHtml(content: string): Promise<string> {
		return new Promise((resolve, reject) => {
			let minifiedContent: string = "";

			try {
				minifiedContent = HTMLminify(content, this.#htmloptions);
			} catch (err) {
				reject("Error while minifying HTML \n" + err);
			}

			resolve(minifiedContent);
		});
	}

	#_minifyJS(content: string): Promise<string> {
		return new Promise((resolve, reject) => {
			import("terser")
				.then(({ minify }) => {
					minify(content)
						.then((result) => {
							resolve(result?.code || "");
						})
						.catch((err) => {
							console.error("Error while minifying javascript\n,", err);
						});
				})
				.catch(reject);
		});
	}

	#_minifyCss(content: string): Promise<string> {
		return new Promise((resolve, reject) => {
			try {
				const { code } = lightningcss({
					filename: "dummyname[input].css",
					code: Buffer.from(content),
					minify: true,
				});

				resolve(code.toString() || "");
			} catch (err) {
				reject("Error while minifying CSS\n" + err);
			}
		});
	}

	async minify(
		mangledFiles: string[],
		fileType: "css" | "html" | "js",
		batchSize: number,
	): Promise<void> {
		let minifyFunction: (content: string) => Promise<string>;

		switch (fileType) {
			case "css":
				minifyFunction = this.#_minifyCss.bind(this);
				break;
			case "html":
				minifyFunction = this.#_minifyHtml.bind(this);
				break;
			case "js":
				minifyFunction = this.#_minifyJS.bind(this);
				break;
		}

		const minifierPromises: (() => Promise<void>)[] = mangledFiles.map(
			(mangledFile: string) => (): Promise<void> =>
				new Promise((resolve, reject) => {
					readFile(mangledFile, { encoding: "utf8" })
						.then((content: string) => {
							minifyFunction(content)
								.then((minifiedContent: string) => {
									writeFile(mangledFile, minifiedContent, {
										encoding: "utf8",
									})
										.then(resolve)
										.catch((err) => {
											reject(
												`Error writing minified content, at:${mangledFile}\n${err}`,
											);
										});
								})
								.catch((err) => {
									reject(
										`Error while minifying content, at:${mangledFile}\n${err}`,
									);
								});
						})
						.catch((err) => {
							reject(
								`Error while reading content, at:${mangledFile}\n${err}`,
							);
						});
				}),
		);

		const promiseBatches: (() => Promise<void>)[][] = [];

		for (let i = 0; i < minifierPromises.length; i += batchSize) {
			promiseBatches.push(minifierPromises.slice(i, i + batchSize));
		}

		for (const batch of promiseBatches) {
			const activatedBatch: Promise<void>[] = batch.map((func) => func());

			try {
				await Promise.all(activatedBatch);
			} catch (err) {
				console.log(err);
			}
		}
	}
}
