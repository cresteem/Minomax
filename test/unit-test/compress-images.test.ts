import { rm } from "node:fs/promises";
import { testCompressImages } from "./util.compress-images";

const destinationBasePath = "test/temp-artifacts/images";
const targetFormat = "webp";
const lookUpPatterns = ["test/samples/images/**"];
const ignorePatterns = [
	"test/samples/images/**/*.jpg",
	"test/samples/images/**/*.svg",
];

test("Unit Test - compressImages()", async () => {
	expect(
		await testCompressImages({
			destinationBasePath: destinationBasePath,
			targetFormat: targetFormat,
			lookUpPatterns: lookUpPatterns,
			ignorePatterns: ignorePatterns,
		}),
	).toBe(true);
}, 100000);

afterAll(() => {
	rm(destinationBasePath, { force: true, recursive: true });
});
