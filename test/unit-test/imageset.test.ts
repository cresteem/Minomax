import { rm } from "node:fs/promises";
import { testImageSet } from "./util.imageset";

const destinationBasePath = "test/temp-artifacts/images-set";
const lookUpPatterns = ["test/samples/webdocs/webroot-sim/**"];
const ignorePatterns = ["test/samples/webdocs/webroot-sim/page2.html"];

test("Unit Test - generateImageSets()", async () => {
	expect(
		await testImageSet({
			destinationBasePath: destinationBasePath,
			lookUpPatterns: lookUpPatterns,
			ignorePatterns: ignorePatterns,
		}),
	).toBe(true);
}, 100000);

afterAll(() => {
	rm(destinationBasePath, { force: true, recursive: true });
});
