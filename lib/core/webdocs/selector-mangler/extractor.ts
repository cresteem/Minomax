import { AtRule, Comment, parse, Rule } from "css";
import { globSync } from "glob";
import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";
import {
	SelectorExtractorResponse,
	UniqueSelectorsResponse,
	WebDocFileListerResponse,
} from "../../../types";
import { terminate } from "../../../utils";

export default class SelectorsExtractor {
	availableSelectors: SelectorExtractorResponse;

	constructor({
		webDocFilesPatterns,
		noDirPatterns,
		fileSearchBasePath,
	}: {
		webDocFilesPatterns: string[];
		noDirPatterns: string[];
		fileSearchBasePath: string;
	}) {
		this.availableSelectors = this.#selectorExtractor(
			webDocFilesPatterns,
			noDirPatterns,
			fileSearchBasePath,
		);
	}

	#_fetchfiles(
		webDocFilesPatterns: string[],
		noDirPatterns: string[],
		fileSearchBasePath: string,
	): WebDocFileListerResponse {
		const webDocFiles: string[] = globSync(webDocFilesPatterns, {
			ignore: noDirPatterns,
			cwd: fileSearchBasePath,
			absolute: true,
		}).filter((path) => statSync(path).isFile());

		/* dumpRunTimeData({ data: webDocFiles, context: "Webdoc Files" }); */

		const cssFiles: string[] = webDocFiles.filter(
			(file) => extname(file) === ".css",
		);

		let cssContents: string = "";

		try {
			cssFiles.forEach((cssFile: string) => {
				const currentCssContent: string = readFileSync(cssFile, {
					encoding: "utf8",
				});
				cssContents += currentCssContent + "\n";
			});
		} catch (err) {
			terminate({ reason: "Error reading CSS file\n" + err });
		}

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

	#selectorExtractor(
		webDocFilesPatterns: string[],
		noDirPatterns: string[],
		fileSearchBasePath: string,
	): SelectorExtractorResponse {
		const { webDocFiles, cssContents } = this.#_fetchfiles(
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
