import { extname } from "node:path";
import { BatchSizeType, HtmlOptions, WebDocOptions } from "../../types";
import { currentTime } from "../../utils";
import Minifier from "./minifier";
import SelectorsMangler from "./selector-mangler/renamer";

export default class WebDocsWorker {
	#htmloptions: HtmlOptions;
	#batchSizes: BatchSizeType;

	constructor(webDocOptions: WebDocOptions, batchSizes: BatchSizeType) {
		const { htmloptions } = webDocOptions;

		this.#htmloptions = htmloptions;
		this.#batchSizes = batchSizes;
	}

	async uglify({
		webDocs,
		destinationBase,
	}: {
		webDocs: string[];
		destinationBase: string;
	}): Promise<void> {
		console.log(
			`\n[${currentTime()}] +++> ⏰ Web Docs minification started.`,
		);

		const selectorsMangler = new SelectorsMangler({
			batchSizes: this.#batchSizes,
		});
		const mangledFiles: Awaited<string[]> =
			await selectorsMangler.renameSelectors({
				webDocs: webDocs,
				destinationBase: destinationBase,
			});

		const minifierBatchSize: number = this.#batchSizes.cPer;
		const minifier = new Minifier({ htmloptions: this.#htmloptions });

		/* dumpRunTimeData({ data: mangledFiles, context: "Mangled files" }); */

		const webDocExtensions: string[] = [".html", ".css", ".js"];
		for (const extension of webDocExtensions) {
			const webdocs: string[] = mangledFiles.filter(
				(file) => extname(file) === extension,
			);
			await minifier.minify(
				webdocs,
				extension.slice(1) as any,
				minifierBatchSize,
			);
		}

		console.log(`[${currentTime()}] +++> ✅ Web docs were minified.`);
	}
}
