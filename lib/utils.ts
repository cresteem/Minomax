import { mkdirSync } from "fs";

export function makeDirf(dirPath: string): void {
	mkdirSync(dirPath, { recursive: true });
}

export function currentTime(): string {
	const currentDate = new Date();
	return `${currentDate.getHours()}:${currentDate.getMinutes()}:${currentDate.getSeconds()}`;
}
