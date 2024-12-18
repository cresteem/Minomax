import { extname } from "node:path";
import { ConfigurationOptions, HtmlOptions } from "../../types";
import { calculateBatchSize, currentTime } from "../../utils";
import Minifier from "./minifier";
import SelectorsMangler from "./selector-mangler/renamer";

export default class WebDocsWorker {
	#destPath: string;
	#htmloptions: HtmlOptions;

	constructor(configurations: ConfigurationOptions) {
		const {
			destPath,
			webdoc: { htmloptions },
		} = configurations;

		this.#destPath = destPath;
		this.#htmloptions = htmloptions;
	}

	async uglify({
		webDocFilesPatterns,
		fileSearchBasePath,
		destinationBase = this.#destPath,
		noDirPatterns = [],
	}: {
		webDocFilesPatterns: string[];
		fileSearchBasePath: string;
		destinationBase: string;
		noDirPatterns: string[];
	}): Promise<void> {
		/* default exclude patterns */
		noDirPatterns.push(...["./node_modules/**", destinationBase + "/**"]);

		console.log(
			`\n[${currentTime()}] +++> ⏰ Web Docs minification started.`,
		);

		const selectorsMangler = new SelectorsMangler();
		const mangledFiles: Awaited<string[]> =
			await selectorsMangler.renameSelectors(
				webDocFilesPatterns,
				destinationBase,
				noDirPatterns,
				fileSearchBasePath,
			);

		const batchSize: number = calculateBatchSize({ perProcMem: 400 });

		console.log(`Number of Web docs in queue: ${mangledFiles.length}`);
		console.log(`Number of Web docs at a time: ${batchSize}`);

		const minifier = new Minifier({ htmloptions: this.#htmloptions });

		const webDocExtensions: string[] = [".html", ".css", ".js"];
		for (const extension of webDocExtensions) {
			const webdocs: string[] = mangledFiles.filter(
				(file) => extname(file) === extension,
			);
			await minifier.minify(webdocs, extension.slice(1) as any, batchSize);
		}

		console.log(`[${currentTime()}] +++> ✅ Web docs were minified.`);
	}
}
