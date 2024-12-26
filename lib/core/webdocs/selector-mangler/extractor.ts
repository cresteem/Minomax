import { AtRule, Comment, parse, Rule } from "css";
import { globSync } from "glob";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import {
	BatchSizeType,
	SelectorExtractorResponse,
	UniqueSelectorsResponse,
	WebDocFileListerResponse,
} from "../../../types";
import { batchProcess, terminate } from "../../../utils";

export default class SelectorsExtractor {
	#batchSizes: BatchSizeType;

	constructor({ batchSizes }: { batchSizes: BatchSizeType }) {
		this.#batchSizes = batchSizes;
	}

	async #_fetchfiles(
		webDocFilesPatterns: string[],
		noDirPatterns: string[],
		fileSearchBasePath: string,
	): Promise<WebDocFileListerResponse> {
		const webDocFiles: string[] = globSync(webDocFilesPatterns, {
			ignore: noDirPatterns,
			cwd: fileSearchBasePath,
			absolute: true,
			nodir: true,
		});

		/* dumpRunTimeData({ data: webDocFiles, context: "Webdoc Files" }); */

		const cssFiles: string[] = webDocFiles.filter(
			(file) => extname(file) === ".css",
		);

		const cssContentPromises: (() => Promise<string>)[] = cssFiles.map(
			(cssFile: string) => () =>
				new Promise((resolve, reject) => {
					readFile(cssFile, { encoding: "utf8" })
						.then(resolve)
						.catch((err) => {
							reject("Error while fetching CSS content\n" + err);
						});
				}),
		);

		const batchResponse: Awaited<string[]> = await batchProcess({
			promisedProcs: cssContentPromises,
			batchSize: this.#batchSizes.cPer,
			context: "Reading CSS",
		});

		const cssContents: string = batchResponse.join("\n");

		return {
			cssContents: cssContents,
			webDocFiles: webDocFiles,
		};
	}

	//  to extract unique class names and IDs
	#_extractUniqueSelectors(
		rules: (Rule | Comment | AtRule)[],
	): UniqueSelectorsResponse {
		const uniqueClassNames: Set<string> = new Set();
		const uniqueIds: Set<string> = new Set();

		function processRules(rules: (Rule | Comment | AtRule)[]) {
			for (const rule of rules) {
				if (rule.type === "rule") {
					/* @ts-ignore */
					for (const selector of rule.selectors ?? []) {
						selector.split(/\s+/).forEach((part: string) => {
							if (part.startsWith(".")) {
								uniqueClassNames.add(part);
							} else if (part.startsWith("#")) {
								uniqueIds.add(part);
							}
						});
					}
				} else if (rule.type === "media") {
					/* @ts-ignore */
					processRules(rule.rules);
				}
			}
		}

		processRules(rules);

		return {
			uniqueClassNames: Array.from(uniqueClassNames),
			uniqueIds: Array.from(uniqueIds),
		};
	}

	// Remove pseudo-classes and pseudo-elements
	#_selectorsCleaner(selectors: string[]): string[] {
		const cleanSelectors: string[] = selectors.map((selector: string) => {
			selector = selector.replace(/::?[\w-]+(?:\(\w+\))?/g, "");

			if (selector.includes("(")) {
				selector = selector.slice(0, selector.indexOf("("));
			}

			if (selector.includes(")")) {
				selector = selector.slice(0, selector.indexOf(")"));
			}

			return selector;
		});

		const uniqueCleanSelectors: Set<string> = new Set(cleanSelectors);

		return Array.from(uniqueCleanSelectors);
	}

	async selectorExtractor({
		webDocFilesPatterns,
		noDirPatterns,
		fileSearchBasePath,
	}: {
		webDocFilesPatterns: string[];
		noDirPatterns: string[];
		fileSearchBasePath: string;
	}): Promise<SelectorExtractorResponse> {
		const { webDocFiles, cssContents } = await this.#_fetchfiles(
			webDocFilesPatterns,
			noDirPatterns,
			fileSearchBasePath,
		);

		const cssRules: (Rule | Comment | AtRule)[] | false =
			parse(cssContents)?.stylesheet?.rules || false;

		if (!cssRules) {
			terminate({ reason: "⚠️ Failed parsing CSS rules" });
		}

		let { uniqueClassNames, uniqueIds } = this.#_extractUniqueSelectors(
			cssRules as any,
		);

		uniqueClassNames = this.#_selectorsCleaner(uniqueClassNames);
		uniqueIds = this.#_selectorsCleaner(uniqueIds);

		return {
			uniqueClassNames: uniqueClassNames,
			uniqueIds: uniqueIds,
			webDocFiles: webDocFiles,
		};
	}
}
