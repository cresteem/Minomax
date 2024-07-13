import { AtRule, Comment, parse, Rule } from "css";
import { readFileSync } from "fs";
import { globSync } from "glob";
import { extname } from "path";
import {
	SelectorExtractorResponse,
	UniqueSelectorsResponse,
	WebDocFileListerResponse,
} from "../options";

function _fetchfiles(
	webDocFilesPatterns: string[],
): WebDocFileListerResponse {
	const webDocFiles: string[] = globSync(webDocFilesPatterns);

	const cssFiles: string[] = webDocFiles.filter(
		(file) => extname(file) === ".css",
	);

	let cssContents: string = "";

	cssFiles.forEach((cssFile: string) => {
		const currentCssContent: string = readFileSync(cssFile, {
			encoding: "utf8",
		});
		cssContents += currentCssContent + "\n";
	});

	return { cssContents: cssContents, webDocFiles: webDocFiles };
}

// Remove pseudo-classes and pseudo-elements
function _selectorsCleaner(selectors: string[]): string[] {
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

// Function to extract unique class names and IDs
function _extractUniqueSelectors(
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

export default function selectorExtractor(
	webDocFilesPatterns: string[],
): SelectorExtractorResponse {
	const { webDocFiles, cssContents } = _fetchfiles(webDocFilesPatterns);

	const cssRules: (Rule | Comment | AtRule)[] | false =
		parse(cssContents)?.stylesheet?.rules ?? false;

	if (!cssRules) {
		console.log("⚠️ Parsing CSS rules failed");
		process.exit(1);
	}

	let { uniqueClassNames, uniqueIds } = _extractUniqueSelectors(cssRules);

	uniqueClassNames = _selectorsCleaner(uniqueClassNames);
	uniqueIds = _selectorsCleaner(uniqueIds);

	console.log(
		`Unique classes count = ${uniqueClassNames.length}\nUnique IDs count = ${uniqueIds.length}`,
	);

	return {
		uniqueClassNames: uniqueClassNames,
		uniqueIds: uniqueIds,
		webDocFiles: webDocFiles,
	};
}
