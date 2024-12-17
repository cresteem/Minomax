import { load } from "cheerio";
import { writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { NewNamesMakerResponse } from "../../../types";
import { calculateBatchSize, writeContent } from "../../../utils";
import SelectorExtractor from "./extracter";

class _SelectorsReplacer {
	#encloser: string = "'"; //* {encloser} string -> enclosing quotes ( ' or " ) default= " .

	constructor() {}

	/*
	 * {content} string -> document content.
	 * {nameRecords} object -> target and replacement values.
	 */
	html(content: string, nameRecords: Record<string, string>): string {
		Object.keys(nameRecords).forEach((oldSelector: string) => {
			const newSelector: string = nameRecords[oldSelector];

			if (oldSelector.startsWith("#")) {
				const idTarget: RegExp = new RegExp(
					"id=[\"']" + oldSelector.slice(1) + "[\"']",
					"g",
				);

				content = content.replace(
					idTarget,
					`id=${this.#encloser}${newSelector.slice(1)}${this.#encloser}`,
				);

				//replace anchor href
				content = content.replaceAll(
					new RegExp(`href=["']${oldSelector}["']`, "g"),
					`href="${newSelector}"`,
				);
			} else {
				const $ = load(content);
				$(oldSelector).each((_idx, elem) => {
					//remove old
					$(elem).removeClass(oldSelector.slice(1));

					//add new
					$(elem).addClass(newSelector.slice(1));
				});

				content = $.html();
			}
		});

		return content;
	}

	/*
	 * {content} string -> js content.
	 * {nameRecords} object -> target and replacement values.
	 */
	js(content: string, nameRecords: Record<string, string>): string {
		Object.keys(nameRecords).forEach((oldSelector) => {
			const newSelector: string = nameRecords[oldSelector];

			let target: RegExp;

			//for id selectors
			if (oldSelector.startsWith("#")) {
				//replace in getbymethods
				target = new RegExp(
					`ById\\(["']\\s?${oldSelector.slice(1)}\\s?["']\\)`,
					"g",
				);
				content = content.replace(
					target,
					`ById(${this.#encloser}${newSelector.slice(1)}${
						this.#encloser
					})`,
				);

				//replace in queryselector
				target = new RegExp(
					"\\s?#" + oldSelector.slice(1) + "(?![\\w-])\\b",
					"g",
				);
				content = content.replace(target, newSelector);

				//replace in elem.id='id';
				target = new RegExp(
					`\\.id\\s?=\\s?["']${oldSelector.slice(1)}["'];`,
					"g",
				);
				content = content.replace(
					target,
					`.id = '${newSelector.slice(1)}';`,
				);
			}
			//for class selectors
			else if (oldSelector.startsWith(".")) {
				//replace in getbymethods
				target = new RegExp(
					`ByClassName\\(["']\\s?${oldSelector.slice(1)}\\s?["']\\)`,
					"g",
				);
				content = content.replace(
					target,
					`ByClassName(${this.#encloser}${newSelector.slice(1)}${
						this.#encloser
					})`,
				);

				//replace in queryselector
				target = new RegExp(
					"\\s?\\." + oldSelector.slice(1) + "(?![\\w-])\\b",
					"g",
				);
				content = content.replace(target, newSelector);

				//replace in classlist.toggle('class')
				target = new RegExp(
					`classList\\.toggle\\(["']${oldSelector.slice(1)}["']\\);`,
					"g",
				);
				content = content.replace(
					target,
					`classList.toggle('${newSelector.slice(1)}');`,
				);

				//replace in elem.className='class';
				target = new RegExp(
					`\\.className\\s?=\\s?["']${oldSelector.slice(1)}["'];`,
					"g",
				);
				content = content.replace(
					target,
					`.className = '${newSelector.slice(1)}';`,
				);
			}
		});

		return content;
	}

	/*
	 * {content} - css content - string.
	 * {nameRecords} - new names reference data - object.
	 */
	css(content: string, nameRecords: Record<string, string>): string {
		Object.keys(nameRecords).forEach((oldSelector) => {
			const newSelector: string = nameRecords[oldSelector];

			let target: RegExp;

			if (oldSelector.startsWith("#")) {
				target = new RegExp(`\\#${oldSelector.slice(1)}(?!-)\\b`, "g");

				content = content.replace(target, newSelector);
			} else if (oldSelector.startsWith(".")) {
				target = new RegExp(`\\.${oldSelector.slice(1)}(?!-)\\b`, "g");

				content = content.replace(target, newSelector);
			}
		});

		return content;
	}
}

export default class SelectorsMangler {
	constructor() {}

	//generate alteration names for selectors
	*#_nameGenerator(): Generator<string> {
		const chars: string = "-_vjqiyfcbkawgtzsxldonruphem";

		let charCount: number = 1;

		while (true) {
			for (let i = 0; i < Math.pow(chars.length, charCount); i++) {
				let name: string = "";
				let num: number = i;

				for (let j = 0; j < charCount; j++) {
					const charIndex: number = num % chars.length;
					name = chars[charIndex] + name;
					num = Math.floor(num / chars.length);
				}

				if (name !== "-") {
					// Exclude strings containing only hyphen
					yield name;
				}
			}

			charCount++;
		}
	}

	//randomize generated alt names
	#_shuffleArray(array: string[]): string[] {
		for (let i: number = array.length - 1; i > 0; i--) {
			const j: number = Math.floor(Math.random() * (i + 1));
			[array[i], array[j]] = [array[j], array[i]];
		}
		return array;
	}

	//assign alt names to each old selectors
	#_newNameAssigner(oldSelectors: string[]): Record<string, string> {
		const nameGenerator: Generator<string> = this.#_nameGenerator();

		const uniqueNames: Set<string> = new Set();

		let currentCount: number = 0;
		/* Making sure unique names count is equals to old selectors count */
		while (currentCount !== oldSelectors.length) {
			/* Only add unique name (non duplicate value) */
			uniqueNames.add(nameGenerator.next().value);
			currentCount = uniqueNames.size;
		}

		const newSelectors: string[] = this.#_shuffleArray(
			Array.from(uniqueNames),
		);

		const nameRecords: Record<string, string> = {};

		for (let i: number = 0; i < oldSelectors.length; i++) {
			const oldSelector: string = oldSelectors[i];

			nameRecords[oldSelector] = oldSelector.startsWith("#")
				? `#${newSelectors[i]}`
				: `.${newSelectors[i]}`;
		}

		return nameRecords;
	}

	#_makeNewNames(
		webDocFilesPatterns: string[],
		noDirPatterns: string[],
		fileSearchBasePath: string,
		map: boolean = false,
	): NewNamesMakerResponse {
		const {
			availableSelectors: { uniqueIds, uniqueClassNames, webDocFiles },
		} = new SelectorExtractor({
			webDocFilesPatterns: webDocFilesPatterns,
			noDirPatterns: noDirPatterns,
			fileSearchBasePath: fileSearchBasePath,
		});

		const newClassNameRecords: Record<string, string> =
			this.#_newNameAssigner(uniqueClassNames);

		const newIDNameRecords: Record<string, string> =
			this.#_newNameAssigner(uniqueIds);

		const newSelectorsRecords: Record<string, string> = {
			...newClassNameRecords,
			...newIDNameRecords,
		};

		if (map) {
			try {
				const newSelectorsMapFile: string = join(
					process.cwd(),
					"minomax.selectors.map.json",
				);

				writeFileSync(
					newSelectorsMapFile,
					JSON.stringify(newSelectorsRecords, null, 2),
				);
			} catch (err) {
				console.log("Errror while writing map file\n" + err);
			}
		}

		return {
			newSelectorsRecords: newSelectorsRecords,
			webDocFiles: webDocFiles,
		};
	}

	//it write new selectors to web resources (js, html, css).
	async renameSelectors(
		webDocFilesPatterns: string[],
		destinationBase: string,
		noDirPatterns: string[],
		fileSearchBasePath: string,
	): Promise<string[]> {
		const { newSelectorsRecords, webDocFiles } = this.#_makeNewNames(
			webDocFilesPatterns,
			noDirPatterns,
			fileSearchBasePath,
		);

		const selectorsReplacer = new _SelectorsReplacer();

		const renamePromises: (() => Promise<void>)[] = webDocFiles.map(
			(file) => (): Promise<void> =>
				new Promise((resolve, reject) => {
					readFile(file, { encoding: "utf-8" })
						.then((content: string) => {
							//handle html files
							if (file.endsWith(".html")) {
								content = selectorsReplacer.html(
									content,
									newSelectorsRecords,
								);
							} //handle js files
							else if (file.endsWith(".js")) {
								content = selectorsReplacer.js(
									content,
									newSelectorsRecords,
								);
							} //handle css files
							else if (file.endsWith(".css")) {
								content = selectorsReplacer.css(
									content,
									newSelectorsRecords,
								);
							}

							const destinationFilePath: string = join(
								destinationBase,
								relative(process.cwd(), file),
							);

							writeContent(content, destinationFilePath)
								.then(resolve)
								.catch((err: Error) => {
									reject(
										`Error updating with renamed content at: ${file}\n${err}`,
									);
								});
						})
						.catch(reject);
				}),
		);

		const batchSize: number = calculateBatchSize({ perProcMem: 400 });

		const promiseBatches = [];

		for (let i = 0; i < renamePromises.length; i += batchSize) {
			promiseBatches.push(renamePromises.slice(i, i + batchSize));
		}

		for (const batch of promiseBatches) {
			const activatedBatch: Promise<void>[] = batch.map((func) => func());

			try {
				await Promise.all(activatedBatch);
			} catch (err) {
				console.log(err);
			}
		}

		const destinatedFiles: string[] = webDocFiles.map((file) =>
			join(destinationBase, relative(process.cwd(), file)),
		);

		return destinatedFiles;
	}
}
