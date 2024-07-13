import { writeFileSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { NewNamesMakerResponse } from "lib/options";
import { join, relative } from "path";
import selectorExtractor from "./extracter";

//generate alteration names for selectors
function* _nameGenerator(): Generator<string> {
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
function _shuffleArray(array: string[]): string[] {
	for (let i: number = array.length - 1; i > 0; i--) {
		const j: number = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

//assign alt names to each old selectors
function _newNameAssigner(oldSelectors: string[]): Record<string, string> {
	const nameGenerator: Generator<string> = _nameGenerator();

	const uniqueNames: Set<string> = new Set();

	let currentCount: number = 0;
	/* Making sure unique names count is equals to old selectors count */
	while (currentCount !== oldSelectors.length) {
		/* Only add unique name (non duplicate value) */
		uniqueNames.add(nameGenerator.next().value);
		currentCount = uniqueNames.size;
	}

	const newSelectors: string[] = _shuffleArray(Array.from(uniqueNames));

	const nameRecords: Record<string, string> = {};

	for (let i: number = 0; i < oldSelectors.length; i++) {
		const oldSelector: string = oldSelectors[i];

		nameRecords[oldSelector] = oldSelector.startsWith("#")
			? `#${newSelectors[i]}`
			: `.${newSelectors[i]}`;
	}

	return nameRecords;
}

/*
 * {content} string -> document content.
 * {nameRecords} object -> target and replacement values.
 * {encloser} string -> enclosing quotes ( ' or " ) default= " .
 */
function _renameSelectorsInHtml(
	content: string,
	nameRecords: Record<string, string>,
	encloser: string = `"`,
): string {
	Object.keys(nameRecords).forEach((oldSelector) => {
		const newSelector: string = nameRecords[oldSelector];

		if (oldSelector.startsWith("#")) {
			const idTarget: RegExp = new RegExp(
				"id=[\"']" + oldSelector.slice(1) + "[\"']",
				"g",
			);

			content = content.replace(
				idTarget,
				`id=${encloser}${newSelector.slice(1)}${encloser}`,
			);
		} else {
			const classTarget: RegExp = new RegExp(
				"class=[\"']" + oldSelector.slice(1) + "[\"']",
				"g",
			);

			content = content.replace(
				classTarget,
				`class=${encloser}${newSelector.slice(1)}${encloser}`,
			);
		}
	});

	return content;
}

/*
 * {content} string -> js content.
 * {nameRecords} object -> target and replacement values.
 * {encloser} string -> enclosing quotes ( ' or " )
 */
function _renameSelectorsInJS(
	content: string,
	nameRecords: Record<string, string>,
	encloser = "'",
): string {
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
				`ById(${encloser}${newSelector.slice(1)}${encloser})`,
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
				`ByClassName(${encloser}${newSelector.slice(1)}${encloser})`,
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
function _renameSelectorsInCSS(
	content: string,
	nameRecords: Record<string, string>,
): string {
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

function _makeNewNames(
	webDocFilesPatterns: string[],
	map: boolean = false,
): NewNamesMakerResponse {
	const { uniqueIds, uniqueClassNames, webDocFiles } = selectorExtractor(
		webDocFilesPatterns,
	);

	const newClassNameRecords: Record<string, string> =
		_newNameAssigner(uniqueClassNames);

	const newIDNameRecords: Record<string, string> =
		_newNameAssigner(uniqueIds);

	const newSelectorsRecords: Record<string, string> = {
		...newClassNameRecords,
		...newIDNameRecords,
	};

	if (map) {
		try {
			const newSelectorsMapFile: string = join(
				process.cwd(),
				".minomaxSelectors.json",
			);

			writeFileSync(
				newSelectorsMapFile,
				JSON.stringify(newSelectorsRecords, null, 2),
			);
		} catch (err) {
			console.log("Errror while writing alt-reference file\t" + err);
		}
	}

	return {
		newSelectorsRecords: newSelectorsRecords,
		webDocFiles: webDocFiles,
	};
}

//it write new selectors to web resources (js, html, css).
export default async function renameSelectors(
	webDocFilesPatterns: string[],
	destinationBase: string,
	batchSize: number = 5,
): Promise<void> {
	const { newSelectorsRecords, webDocFiles } = _makeNewNames(
		webDocFilesPatterns,
	);

	const promises: (() => Promise<void>)[] = [];

	webDocFiles.forEach((file) => {
		promises.push((): Promise<void> => {
			return new Promise((resolve, reject) => {
				readFile(file, { encoding: "utf-8" })
					.then((content: string) => {
						//handle html files
						if (file.endsWith(".html")) {
							content = _renameSelectorsInHtml(
								content,
								newSelectorsRecords,
							);
						} //handle js files
						else if (file.endsWith(".js")) {
							content = _renameSelectorsInJS(content, newSelectorsRecords);
						} //handle css files
						else if (file.endsWith(".css")) {
							content = _renameSelectorsInCSS(
								content,
								newSelectorsRecords,
							);
						}

						const destinationFilePath: string = join(
							destinationBase,
							relative(process.cwd(), file),
						);

						writeFile(destinationFilePath, content)
							.then(resolve)
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
