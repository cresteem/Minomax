import cssnano from "cssnano";
import nanocss_adv from "cssnano-preset-advanced";
import { readFile, writeFile } from "fs/promises";
import { minify as HTMLminify } from "html-minifier";
import { extname } from "path";
import postcss from "postcss";
import configurations from "../../configLoader";
import { allocateBatchSize, currentTime } from "../utils";
import renameSelectors from "./css-mangler/renamer";

function minifyHtml(content: string): Promise<string> {
	const {
		webdoc: { htmloptions },
	} = configurations;

	return new Promise((resolve, reject) => {
		let minifiedContent: string;

		try {
			minifiedContent = HTMLminify(content, htmloptions);
		} catch (err) {
			reject(err);
		}

		setTimeout(() => {
			resolve(minifiedContent);
		}, 1);
	});
}

async function minifyJS(content: string): Promise<string> {
	return new Promise((resolve, reject) => {
		import("terser")
			.then(({ minify }) => {
				minify(content)
					.then((result) => {
						resolve(result?.code ?? "");
					})
					.catch(reject);
			})
			.catch(reject);
	});
}

function minifyCss(content: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const postcssplugin: any[] = [cssnano({ preset: nanocss_adv })];

		postcss(postcssplugin)
			.process(content, { from: undefined })
			.then((result) => {
				resolve(result?.css ?? "");
			})
			.catch(reject);
	});
}

async function _minifier(
	mangledFiles: string[],
	fileType: "css" | "html" | "js",
	batchSize: number,
): Promise<void> {
	const promises: (() => Promise<void>)[] = [];

	let minifyFunction: Function;

	switch (fileType) {
		case "css":
			minifyFunction = minifyCss;
			break;
		case "html":
			minifyFunction = minifyHtml;
			break;
		case "js":
			minifyFunction = minifyJS;
			break;
	}

	mangledFiles.forEach((mangledFile: string) => {
		promises.push((): Promise<void> => {
			return new Promise((resolve, reject) => {
				readFile(mangledFile, { encoding: "utf8" })
					.then((content: string) => {
						minifyFunction(content)
							.then((result: any) => {
								writeFile(mangledFile, result, {
									encoding: "utf8",
								})
									.then(resolve)
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
	destinationBase: string = configurations.destPath,
	fileSearchBasePath: string,
	noDirPatterns: string[] = [],
): Promise<void> {
	if (noDirPatterns.length === 0) {
		noDirPatterns = ["./node_modules/**", destinationBase + "/**"];
	}

	const batchSize: number = allocateBatchSize(400);

	console.log(
		`\n[${currentTime()}] +++> Web docs minification process started.`,
	);

	const mangledFiles: Awaited<string[]> = await renameSelectors(
		webDocFilesPatterns,
		destinationBase,
		noDirPatterns,
		fileSearchBasePath,
	);

	console.log(`Number of Web docs in queue: ${mangledFiles.length}`);
	console.log(`Number of Web docs at a time: ${batchSize}`);

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

	console.log(`\n[${currentTime()}] +++> Web docs were minified.`);
}
