const { statSync, existsSync } = require("fs");
const { htmlParser } = require("../lib/imgsetgen/htmlparser");
const { join, dirname, relative, basename, extname } = require("path");
const sharp = require("sharp");
const { imageGenerator } = require("../lib/imgsetgen/index");

//global config
const userConfig = join(process.cwd(), "mebxip.config.js");
const { imageSetConfigurations } = existsSync(userConfig)
  ? require(userConfig)
  : require("../mebxip.config");

//parameters
const destination = "dist";
const filesGlob = "testmedia/webdoc/**.html";

//for precleanertest
const postProcessTime = new Date().getTime();

function preCleanerTest(destination) {
  //check creation time
  let fctime;
  try {
    fctime = statSync(destination).birthtime.getTime();
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error("Output dir not created");
      return false;
    }
  }
  return postProcessTime < fctime;
}

//shared sources for multiple fun
const sources = new Array();

async function init() {
  const availableHTMLsMeta = await htmlParser(
    filesGlob,
    imageSetConfigurations.screenSizes
  );

  availableHTMLsMeta.forEach((html) => {
    html.records.forEach((img) => {
      const effectiveSrcPath = img.srcName
        .replace(/\//g, "//")
        .replace(/\\/g, "//");

      const expectations = {
        baseImage: relative(".", join(dirname(html.file), effectiveSrcPath)),
        baseImageSets: null,
      };

      const imageSizes = img.imageSizes;
      const imageSets = {};

      for (const setType of Object.keys(imageSizes)) {
        const isSVG = extname(expectations.baseImage) === ".svg";

        imageSets[setType] = { image: null, size: null };
        imageSets[setType].size = imageSizes[setType];

        if (isSVG) {
          imageSets[setType].image = join(
            destination,
            dirname(expectations.baseImage),
            "svg",
            basename(expectations.baseImage)
          );
          break;
        } else {
          const nonsvg =
            basename(expectations.baseImage, extname(expectations.baseImage)) +
            `@${setType}${extname(expectations.baseImage)}`;
          imageSets[setType].image = join(
            destination,
            dirname(expectations.baseImage),
            basename(html.file, extname(html.file)),
            setType,
            nonsvg
          );
        }
      }
      //
      expectations.baseImageSets = imageSets;
      sources.push(expectations);
    });
  });
  /* console.log(JSON.stringify(sources, null, 3)); */
}

async function outputfileEnsure() {
  await init();
  //check if files are existing
  for (const imagesetMeta of sources) {
    const imageSets = imagesetMeta.baseImageSets;

    for (const setType of Object.keys(imageSets)) {
      if (
        !existsSync(imageSets[setType].image) &&
        existsSync(imagesetMeta.baseImage)
      ) {
        console.error(
          "Failed: ",
          imageSets[setType].image,
          " is not created by program"
        );
        return false;
      }
    }
  }

  return true;
}

async function outputfileSizeTest() {
  //check if all image size are valid
  for (const imagesetMeta of sources) {
    if (extname(imagesetMeta.baseImage) === ".svg") {
      continue;
    }

    const imageSets = imagesetMeta.baseImageSets;

    for (const setType of Object.keys(imageSets)) {
      //get image sizes
      const opMeta = await sharp(imageSets[setType].image).metadata();

      if (imageSets[setType].size.width !== opMeta.width) {
        console.error(
          imageSets[setType].size.width,
          " Not matched to ",
          opMeta.width
        );
        return false;
      }
    }
  }
  return true;
}

function obsoleteFileTester() {
  for (const imageMeta of sources) {
    const obsolete = join(
      dirname(imageMeta.baseImage),
      `${basename(imageMeta.baseImage, extname(imageMeta.baseImage))}${
        imageSetConfigurations.fileSuffix
      }${extname(imageMeta.baseImage)}`
    );

    if (existsSync(obsolete)) {
      return false;
    }
  }
  return true;
}

//calling test

test("Checking whether all outputs are generated as expected or not", async () => {
  await imageGenerator(filesGlob, destination);
  expect(await outputfileEnsure()).toBe(true);
}, 100000);

test("Checking whether all outputs are generated in expected size or not", async () => {
  expect(await outputfileSizeTest()).toBe(true);
});

test("PreCleaner Test", () => {
  expect(preCleanerTest(destination)).toBe(true);
});

test("Obsolete file testing", () => {
  expect(obsoleteFileTester()).toBe(true);
});
