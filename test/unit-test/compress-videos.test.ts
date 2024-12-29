import { testCompressVideos } from "./util.compress-videos";

const destinationBasePath = "test/.temp-artifacts/videos";
const lookUpPatterns = ["test/samples/videos/*.mp4"];
const ignorePatterns = ["test/samples/videos/*C.mp4"];
const codecType = "mx265";
const encodeLevel = 1;

test("Unit Test - compressVideos()", async () => {
	expect(
		await testCompressVideos({
			destinationBasePath: destinationBasePath,
			lookUpPatterns: lookUpPatterns,
			ignorePatterns: ignorePatterns,
			codecType: codecType,
			encodeLevel: encodeLevel,
		}),
	).toBe(true);
}, 60000);
