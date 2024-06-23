const { glob } = require("glob");
const { imageWorker } = require("../lib/imageworker");
const { statSync, existsSync } = require("fs");

//parameters
const imageWorkerSettings = {
  imgGlobPaths: [
    "dist/**/*.svg",
    "dist/**/*.jpg",
    "dist/**/*.jpeg",
    "dist/**/*.png",
    "dist/**/*.bmp",
  ],
  imgTypes: ["svg", "jpg", "avif", "webp", "jpg"],
};

//common holder
let images;
let uncompressedImagesMeta = new Array();
let compressedImagesMeta = new Array();

async function getFilesSize(compressed = false) {
  //list of images
  if (!images) {
    //cond to only fetch one time and assign
    images = await glob(imageWorkerSettings.imgGlobPaths);
  }

  images.forEach((img) => {
    //get images sizes and push to public holder
    if (compressed) {
      compressedImagesMeta.push({ image: img, byte: statSync(img).size });
    } else {
      uncompressedImagesMeta.push({ image: img, byte: statSync(img).size });
    }
  });
}

async function compressImage() {
  //compress images
  let index = 0;
  for (const imgGlob of imageWorkerSettings.imgGlobPaths) {
    await imageWorker(imgGlob, imageWorkerSettings.imgTypes[index], ".");
    index += 1;
  }
}

function fileExistanceCheck() {
  for (const image of images) {
    if (!existsSync(image)) {
      return false;
    }
  }
  return true;
}

async function comparison() {
  //fetch uncompressed files size
  await getFilesSize(false);

  //make compression
  await compressImage();

  //fetch compressed files size
  await getFilesSize(true);

  for (let i = 0; i < images.length; i++) {
    const compressedSize = compressedImagesMeta[i].byte;
    const uncompressedSize = uncompressedImagesMeta[i].byte;
    if (
      compressedSize === uncompressedSize ||
      compressedSize > uncompressedSize
    ) {
      console.error(
        `${uncompressedImagesMeta[i].image} = ${uncompressedSize}\n Compressed Image = ${compressedSize}`
      );
      return false;
    }
  }
  return true;
}

test("ImageWorker Source and OP comparison going", async () => {
  expect(await comparison()).toBe(true);
}, 1000000);

test("Validating files", () => {
  expect(fileExistanceCheck()).toBe(true);
});
