import cssnano from "cssnano";
import nanocss_adv from "cssnano-preset-advanced";
import { readFile, writeFile } from "fs/promises";
import { minify as HTMLminify } from "html-minifier";
import { extname } from "path";
import postcss from "postcss";
import configurations from "../../configLoader";
import renameSelectors from "./css-mangler/renamer";

async function _minifier(
	mangledFiles: string[],
	fileType: "css" | "html" | "js",
	batchSize: number,
): Promise<void> {
	let minifyFunction;

	if (fileType === "html") {
		const {
			webdoc: { htmloptions },
		} = configurations;

		minifyFunction = (content: string): Promise<string> => {
			return new Promise((resolve) => {
				const minifiedContent: string = HTMLminify(content, htmloptions);

				setTimeout(() => {
					resolve(minifiedContent);
				}, 1);
			});
		};
	} else if (fileType === "js") {
		const { minify } = await import("terser");

		minifyFunction = minify;
	} else {
		const postcssplugin: any[] = [cssnano({ preset: nanocss_adv })];

		minifyFunction = postcss(postcssplugin).process;
	}

	const promises: (() => Promise<void>)[] = [];

	mangledFiles.forEach((mangledFile: string) => {
		promises.push((): Promise<void> => {
			return new Promise((resolve, reject) => {
				readFile(mangledFile, { encoding: "utf8" })
					.then((content: string) => {
						minifyFunction(content)
							.then((result: any) => {
								const resultContent: string =
									fileType === "html"
										? result ?? ""
										: fileType === "js"
										? result?.code ?? ""
										: result?.css ?? "";

								writeFile(mangledFile, resultContent, {
									encoding: "utf8",
								})
									.then(() => {
										resolve();
									})
									.catch(reject);
							})
							.catch(reject);
					})
					.catch(reject);
			});
		});
	});

	const promiseBatches = [];

	for (let i = 0; i < promises.length; i += batchSize) {
		promiseBatches.push(promises.slice(i, i + batchSize));
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

export default async function webDocWorker(
	webDocFilesPatterns: string[],
	noDirPatterns: string[],
	destinationBase: string,
	batchSize: number,
): Promise<void> {
	if (!noDirPatterns) {
		noDirPatterns = ["./node_modules/**", destinationBase + "/**"];
	}

	const mangledFiles: Awaited<string[]> = await renameSelectors(
		webDocFilesPatterns,
		destinationBase,
		noDirPatterns,
		batchSize,
	);

	const mangledHTMLFiles: string[] = [...mangledFiles].filter(
		(file) => extname(file) === ".html",
	);
	await _minifier(mangledHTMLFiles, "html", batchSize);

	const mangledCSSFiles: string[] = [...mangledFiles].filter(
		(file) => extname(file) === ".css",
	);
	await _minifier(mangledCSSFiles, "css", batchSize);

	const mangledJSFiles: string[] = [...mangledFiles].filter(
		(file) => extname(file) === ".js",
	);
	await _minifier(mangledJSFiles, "js", batchSize);
}
