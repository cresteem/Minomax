import { testVideoThumbnailMaker } from "./util.video-thumbnail";

const htmlLookupPattern = ["test/samples/webdocs/**/*.html"];
const ignorePatterns = ["test/samples/webdocs/**/*ML.html"];
const variableImgFormat = "jpg";
const videoCodec = "mx265";

test("Unit Test - makeVideoThumbnail()", async () => {
	expect(
		await testVideoThumbnailMaker({
			htmlLookupPattern: htmlLookupPattern,
			ignorePatterns: ignorePatterns,
			variableImgFormat: variableImgFormat,
			videoCodec: videoCodec,
		}),
	).toBe(true);
});
