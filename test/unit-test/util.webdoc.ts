import { CheerioAPI, load } from "cheerio/slim";
import { parse } from "css";
import { ESLint } from "eslint";
import { globSync } from "glob";
import { readFile } from "node:fs/promises";
import { cpus } from "node:os";
import { extname, resolve as fsResolve, relative } from "node:path";
import { batchProcess } from "../../lib/utils";
import { Minomax } from "../../minomax";
import { calculateTotalSize } from "./util.base";

const minomax = new Minomax();

export async function testWebDocWorker({
	lookUpPatterns,
	lookUpBasePath,
	destinationBasePath,
	ignorePatterns,
}: {
	lookUpPatterns: string[];
	lookUpBasePath: string;
	destinationBasePath: string;
	ignorePatterns: string[];
}) {
	await minomax.minifyWebdoc({
		lookUpBasePath: lookUpBasePath,
		lookUpPatterns: lookUpPatterns,
		destinationBasePath: destinationBasePath,
		ignorePatterns: ignorePatterns,
	});

	/* 1) file discovery and 2) output destination test */
	const expectedFiles = globSync(lookUpPatterns, {
		cwd: lookUpBasePath,
		ignore: ignorePatterns,
		absolute: true,
		nodir: true,
	});

	const destinatedFiles = globSync(["**/*.js", "**/*.html", "**/*.css"], {
		cwd: destinationBasePath,
		absolute: true,
		nodir: true,
	});

	const fileDiscovery_OPDest_PASSED =
		expectedFiles.length === destinatedFiles.length;

	console.log(
		"WebDoc - fileDiscovery_OPDest:",
		fileDiscovery_OPDest_PASSED ? "✅ PASSED" : "❌ Failed",
	);

	//minification test
	/* 3.1) File size comparison */
	const uncompressedFilesSize = await calculateTotalSize(expectedFiles);

	const compressedFilesSize = await calculateTotalSize(destinatedFiles);

	const sizeComparison_PASSED =
		uncompressedFilesSize > compressedFilesSize;

	console.log(
		"WebDoc sizeComparison:",
		sizeComparison_PASSED ? "✅ PASSED" : "❌ Failed",
	);
	console.log(
		"🚀 WebDoc File Sizes reduced by",
		100 - (compressedFilesSize / uncompressedFilesSize) * 100,
		"%",
	);

	/* 3.2 Integrity test */
	const htmlIntegrity_PASSED = await new HTMLIntegrity().check(
		destinatedFiles.filter((file) => extname(file) === ".html"),
		destinationBasePath,
	);
	console.log(
		"HTML Integrity:",
		htmlIntegrity_PASSED ? "✅ PASSED" : "❌ Failed",
	);

	const cssIntegrity_PASSED = await new CSSIntegrity().check(
		destinatedFiles.filter((file) => extname(file) === ".css"),
	);
	console.log(
		"CSS Integrity:",
		cssIntegrity_PASSED ? "✅ PASSED" : "❌ Failed",
	);

	const jsIntegrity_PASSED = await new JSIntegrity().check(
		destinatedFiles.filter((file) => extname(file) === ".js"),
	);
	console.log(
		"JS Integrity:",
		jsIntegrity_PASSED ? "✅ PASSED" : "❌ Failed",
	);

	const PASSED =
		fileDiscovery_OPDest_PASSED &&
		sizeComparison_PASSED &&
		htmlIntegrity_PASSED &&
		cssIntegrity_PASSED &&
		jsIntegrity_PASSED;

	return PASSED;
}

class HTMLIntegrity {
	_loadHTML(filePath: string): Promise<CheerioAPI> {
		return new Promise((resolve, reject) => {
			readFile(filePath, "utf-8")
				.then((html) => {
					resolve(load(html));
				})
				.catch(reject);
		});
	}

	_countDOM($: CheerioAPI): number {
		return $("*").length;
	}

	// Compare the two DOMs
	_compareDOMs(
		sourceFile: string,
		minifiedFile: string,
	): Promise<boolean> {
		return new Promise((resolve, reject) => {
			this._loadHTML(sourceFile)
				.then((sourceHtmlDOM) => {
					this._loadHTML(minifiedFile)
						.then((minifiedHtmlDOM) => {
							const sourceDOM = this._countDOM(sourceHtmlDOM);
							const minifiedDOM = this._countDOM(minifiedHtmlDOM);

							const same = sourceDOM === minifiedDOM;
							resolve(same);
						})
						.catch(reject);
				})
				.catch(reject);
		});
	}

	async check(
		minifiedFiles: string[],
		destinationBasePath: string,
	): Promise<boolean> {
		const integrityPromises = minifiedFiles.map(
			(minifiedFile) => () =>
				new Promise((resolve, reject) => {
					const sourceFile = fsResolve(
						relative(destinationBasePath, minifiedFile),
					);

					this._compareDOMs(sourceFile, minifiedFile)
						.then(resolve)
						.catch(reject);
				}),
		);

		const integrityResponses = await batchProcess({
			promisedProcs: integrityPromises,
			batchSize: cpus().length,
			context: "HTML integrity",
		});

		return integrityResponses.every((passed) => passed);
	}
}

class CSSIntegrity {
	_loadCSS(cssPath: string): Promise<string> {
		return new Promise((resolve, reject) => {
			readFile(cssPath, "utf-8")
				.then((css) => {
					resolve(css);
				})
				.catch(reject);
		});
	}

	_parseCSS(cssContent: string): boolean {
		try {
			parse(cssContent);
			return true;
		} catch (error) {
			return false;
		}
	}

	async check(minifiedFiles: string[]): Promise<boolean> {
		const integrityPromises = minifiedFiles.map(
			(minifiedFile) => () =>
				new Promise((resolve, reject) => {
					this._loadCSS(minifiedFile)
						.then((cssContent) => {
							const isValid = this._parseCSS(cssContent);
							resolve(isValid);
						})
						.catch(reject);
				}),
		);

		const integrityResponses = await batchProcess({
			promisedProcs: integrityPromises,
			batchSize: cpus().length,
			context: "CSS integrity",
		});

		return integrityResponses.every((passed) => passed);
	}
}

class JSIntegrity {
	private eslint: ESLint;

	constructor() {
		this.eslint = new ESLint();
	}

	private _loadJS(jsPath: string): Promise<string> {
		return new Promise((resolve, reject) => {
			readFile(jsPath, "utf-8")
				.then((jsContent) => resolve(jsContent))
				.catch((_error) =>
					reject(new Error(`Failed to read JS file: ${jsPath}`)),
				);
		});
	}

	private _lintJS(jsContent: string): Promise<boolean> {
		return new Promise((resolve) => {
			this.eslint
				.lintText(jsContent)
				.then((results) => {
					const isValid = results.every(
						(result) => result.errorCount === 0,
					);
					resolve(isValid);
				})
				.catch((error) => {
					console.log(error);
					resolve(false);
				});
		});
	}

	async check(minifiedFiles: string[]): Promise<boolean> {
		const integrityPromises = minifiedFiles.map(
			(minifiedFile) => () =>
				new Promise((resolve) => {
					this._loadJS(minifiedFile)
						.then((jsContent) => this._lintJS(jsContent))
						.then((isValid) => resolve(isValid))
						.catch(() => resolve(false));
				}),
		);

		const integrityResponses = await batchProcess({
			promisedProcs: integrityPromises,
			batchSize: cpus().length,
			context: "JS integrity",
		});

		return integrityResponses.every((passed) => passed);
	}
}
