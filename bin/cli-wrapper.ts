#! node

import { spawnSync } from "node:child_process";
import { cpus } from "node:os";
import { join, relative, resolve } from "node:path";

//80% threads utilization
const UV_THREADPOOL_SIZE = Math.floor((cpus().length * 80) / 100);

const setVar: string = `${
	["linux", "darwin"].includes(process.platform) ? "export" : "set"
} UV_THREADPOOL_SIZE=${UV_THREADPOOL_SIZE}`;

//make absolute path of api program if given
const apiProgramFile: string | boolean = process.argv[2]?.endsWith(".js")
	? resolve(relative(process.cwd(), process.argv[2]))
	: false;

const program: string = resolve(
	join(__dirname, apiProgramFile ? "api-call-wrapper.js" : "cli.js"),
);

const payload = apiProgramFile || process.argv.slice(2).join(" ");

const comand: string = `${setVar} && node ${program} ${payload}`;

spawnSync(comand, {
	shell: true,
	stdio: "inherit",
});
