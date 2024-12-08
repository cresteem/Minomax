import { copyFileSync } from "node:fs";
import { join } from "node:path";

export default function initConfig() {
	const sourceConfig = join(__dirname, "user-config-template.js");
	const dest = join(process.cwd(), "minomax.config.js");
	copyFileSync(sourceConfig, dest);
}
