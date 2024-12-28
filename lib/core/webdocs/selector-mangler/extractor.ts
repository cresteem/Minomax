import { AtRule, Comment, parse, Rule } from "css";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import {
	BatchSizeType,
	SelectorExtractorResponse,
	UniqueSelectorsResponse,
} from "../../../types";
import { batchProcess, terminate } from "../../../utils";

export default class SelectorsExtractor {
	#batchSizes: BatchSizeType;

	constructor({ batchSizes }: { batchSizes: BatchSizeType }) {
		this.#batchSizes = batchSizes;
	}

	async #_getCSSContent(cssFiles: string[]) {
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

		return cssContents;
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

	async selectorExtractor(
		webDocFiles: string[],
	): Promise<SelectorExtractorResponse> {
		const cssContents: string = await this.#_getCSSContent(
			webDocFiles.filter(
				(filePath: string) => extname(filePath) === ".css",
			),
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
