const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const { videoWorker } = require("../lib/videoworker");
const { glob } = require("glob");
const { promisify } = require("util");
const { statSync, existsSync } = require("fs");
const { join } = require("path");

//parameters
const videoGlobPaths = ["testmedia/videos/*.mp4"];
const format = "mp4";
const encoder = "x265";
const level = 1;
const destination = "dist";

//public props
let videos;
let uncompressedVideosMeta = new Array();
let compressedVideosMeta = new Array();
const ffprobeSync = promisify(ffmpeg.ffprobe);

async function getVideoMeta(compressed = false) {
  //list of images
  if (!videos) {
    //cond to only fetch one time and assign
    videos = await glob(videoGlobPaths);
  }
  for (const video of videos) {
    const compressedVideo = join(destination, video);
    const vid = compressed ? compressedVideo : video;
    const videoMeta = {
      video: vid,
      byte: statSync(vid).size,
      duration: (await ffprobeSync(vid)).format.duration.toFixed(1),
    };

    compressed
      ? compressedVideosMeta.push(videoMeta)
      : uncompressedVideosMeta.push(videoMeta);
  }
}

async function compressVideo() {
  //compress videos
  await videoWorker(videoGlobPaths, format, encoder, level, destination);
}

async function comparison() {
  //fetch uncompressed videos size
  await getVideoMeta(false);

  //make compression
  await compressVideo();

  //fetch compressed videos size
  await getVideoMeta(true);

  for (let i = 0; i < videos.length; i++) {
    const compressedSize = compressedVideosMeta[i].byte;
    const uncompressedSize = uncompressedVideosMeta[i].byte;
    if (
      compressedSize === uncompressedSize ||
      compressedSize > uncompressedSize
    ) {
      console.error(
        `${uncompressedVideosMeta[i].video} = ${uncompressedSize}\n Compressed Video = ${compressedSize}`
      );
      return false;
    }
  }
  return true;
}

function videoExistanceCheck() {
  for (const video of videos) {
    if (!existsSync(video)) {
      return false;
    }
  }
  return true;
}

function videoIntegrityTest() {
  for (let i = 0; i < videos.length; i++) {
    const compressedVideoDuration = compressedVideosMeta[i].duration;
    const uncompressedVideoDuration = uncompressedVideosMeta[i].duration;
    if (compressedVideoDuration !== uncompressedVideoDuration) {
      console.error(
        `${uncompressedVideosMeta[i].video} = ${uncompressedVideoDuration}\n Compressed Video = ${compressedVideoDuration}`
      );
      return false;
    }
  }
  return true;
}

test("Video Output comparison", async () => {
  expect(await comparison()).toBe(true);
}, 100000);

test("Checking whether all video are processed and made or not", () => {
  expect(videoExistanceCheck()).toBe(true);
});

test("Video Integrity Test", () => {
  expect(videoIntegrityTest()).toBe(true);
});
