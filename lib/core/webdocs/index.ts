import { copyFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { BatchSizeType, HtmlOptions, WebDocOptions } from "../../types";
import { batchProcess, currentTime } from "../../utils";
import Minifier from "./minifier";
import SelectorsMangler from "./selector-mangler/renamer";

export default class WebDocsWorker {
	#htmloptions: HtmlOptions;
	#batchSizes: BatchSizeType;
	#selectorRenamer: boolean;

	constructor(
		webDocOptions: WebDocOptions,
		batchSizes: BatchSizeType,
		selectorRenamer: boolean,
	) {
		const { htmloptions } = webDocOptions;

		this.#htmloptions = htmloptions;
		this.#batchSizes = batchSizes;
		this.#selectorRenamer = selectorRenamer;
	}

	async #_justCopy(
		sourceFiles: string[],
		destinationBase: string,
	): Promise<string[]> {
		const destinationFilePaths = sourceFiles.map((sourceFile) =>
			join(destinationBase, relative(process.cwd(), sourceFile)),
		);

		const copyPromises = destinationFilePaths.map(
			(destinationPath, idx) => () =>
				copyFile(sourceFiles[idx], destinationPath),
		);

		await batchProcess({
			promisedProcs: copyPromises,
			batchSize: this.#batchSizes.cPer,
			context: "_justCopy()",
		});

		return destinationFilePaths;
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

		let sourceWebdocs: string[] = [];

		if (this.#selectorRenamer) {
			const selectorsMangler = new SelectorsMangler({
				batchSizes: this.#batchSizes,
			});
			sourceWebdocs = await selectorsMangler.renameSelectors({
				webDocs: webDocs,
				destinationBase: destinationBase,
			});
		} else {
			sourceWebdocs = await this.#_justCopy(webDocs, destinationBase);
		}

		const minifierBatchSize: number = this.#batchSizes.cPer;
		const minifier = new Minifier({ htmloptions: this.#htmloptions });

		/* dumpRunTimeData({ data: mangledFiles, context: "Mangled files" }); */

		const webDocExtensions: string[] = [".html", ".css", ".js"];
		for (const extension of webDocExtensions) {
			const webdocs: string[] = sourceWebdocs.filter(
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
