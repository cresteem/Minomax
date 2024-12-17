import { copyFileSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { terminate } from "../lib/utils";

const defaultConfigPaths: Record<string, string> = {
	win32: `${process.env.APPDATA}/Code/User/settings.json`,
	darwin: `${process.env.HOME}/Library/Application/Code/User/settings.json`,
	linux: `${process.env.HOME}/.config/Code/User/settings.json`,
};

const userSettings: string = defaultConfigPaths[process.platform];

function getSettingObject(
	configPath: string,
): Promise<Record<string, any>> {
	return new Promise((resolve, reject) => {
		readFile(configPath, { encoding: "utf8" })
			.then((currentConfigs: string) => {
				const configObject: Record<string, any> =
					JSON.parse(currentConfigs);

				resolve(configObject);
			})
			.catch((err) => {
				reject("Error Reading Configuration \n" + err);
			});
	});
}

function appendSettings(
	configObject: Record<string, any>,
	configPath: string,
): Promise<void> {
	const currentSettings: Record<string, any> = configObject;

	const iconAssociationObject = {
		"material-icon-theme.files.associations": {
			"minomax.config.ts": "../../icons/minomax-icon",
			"minomax.config.js": "../../icons/minomax-icon",
			"minomax.config.mjs": "../../icons/minomax-icon",
			"minomax.config.cjs": "../../icons/minomax-icon",
		},
	};

	/* Associate icon to configuration file. */
	copyMinomaxIcon();
	const newConfigs = { ...currentSettings, ...iconAssociationObject };
	/*  */

	return new Promise((resolve, reject) => {
		writeFile(configPath, JSON.stringify(newConfigs, null, 3))
			.then(() => {
				resolve();
			})
			.catch((err) => {
				reject(err);
			});
	});
}

export default function writeSettings(): Promise<void> {
	return new Promise(async (resolve, reject) => {
		try {
			const configObject: Record<string, any> = await getSettingObject(
				userSettings,
			);

			appendSettings(configObject, userSettings)
				.then(resolve)
				.catch(reject);
		} catch (err: any) {
			reject("Error while asociating minomax icon with config\n" + err);
		}
	});
}

function copyMinomaxIcon(): void {
	const userHome: string = (
		process.platform === "win32"
			? join(process.env.HOMEDRIVE ?? "", process.env.HOMEPATH ?? "")
			: process.env.HOME
	) as string;

	const destPath = join(
		userHome,
		".vscode",
		"extensions",
		"icons",
		"minomax-icon.svg",
	);

	const source = join(__dirname, "..", "..", "logo", "minomax-icon.svg");

	try {
		mkdirSync(dirname(destPath), { recursive: true });
		copyFileSync(source, destPath);
	} catch (err) {
		terminate({ reason: "Error copying icon: " + err });
	}
}
