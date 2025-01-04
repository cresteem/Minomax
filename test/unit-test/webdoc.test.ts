import { rm } from "node:fs/promises";
import { testWebDocWorker } from "./util.webdoc";

const lookUpPatterns = ["test/samples/webdocs/**"];
const ignorePatterns = ["test/samples/webdocs/**/*ML.html"];
const lookUpBasePath = process.cwd();
const destinationBasePath = "test/.temp-artifacts/webdoc";

test("Unit Test - WebDocWorker", async () => {
	expect(
		await testWebDocWorker({
			lookUpBasePath: lookUpBasePath,
			lookUpPatterns: lookUpPatterns,
			ignorePatterns: ignorePatterns,
			destinationBasePath: destinationBasePath,
		}),
	).toBe(true);
});

afterAll(() => {
	rm(destinationBasePath, { force: true, recursive: true });
});
