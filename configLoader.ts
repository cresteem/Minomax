import { existsSync } from "node:fs";
import { join } from "node:path";
import { ConfigurationOptions } from "./lib/types";
import { terminate } from "./lib/utils";

export default function loadConfig(): ConfigurationOptions {
	const CONFIG_FILE_NAME = "minomax.config";

	const projectConfigFile = join(process.cwd(), `${CONFIG_FILE_NAME}.js`);
	const projectHasConfig = existsSync(projectConfigFile);

	let projectConfig: ConfigurationOptions = {} as ConfigurationOptions;
	let defaultConfig: ConfigurationOptions = {} as ConfigurationOptions;

	if (projectHasConfig) {
		//load project config
		try {
			projectConfig = require(projectConfigFile).default;
		} catch (err) {
			terminate({ reason: "Error while loading settings\n" + err });
		}
	}

	//load default configuration
	defaultConfig = require(join(__dirname, CONFIG_FILE_NAME)).default;

	const configurations: ConfigurationOptions = {
		...defaultConfig,
		...projectConfig,
	};

	return configurations;
}
