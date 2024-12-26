import { spawnSync } from "node:child_process";
import { terminate } from "../lib/utils";

const programFilePath: string = process.argv[2] || "";

if (!programFilePath) {
	terminate({ reason: "module path not given" });
}

const command: string = `node ${programFilePath}`;

spawnSync(command, { stdio: "inherit", shell: true });
