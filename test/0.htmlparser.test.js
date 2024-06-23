const { htmlParser } = require("../lib/imgsetgen/htmlparser");

const _ = require("lodash");

const { writeFileSync, existsSync } = require("fs");
const { join } = require("path");

//global config
const userConfig = join(process.cwd(), "mebxip.config.js");

const screenSizes = existsSync(userConfig)
  ? require(userConfig).imageSetConfigurations.screenSizes
  : require("../mebxip.config").imageSetConfigurations.screenSizes;

function writeObjectToFile(object, filePath) {
  // Convert the object to a JSON string
  const jsonString = JSON.stringify(object, null, 2);

  // Write the JSON string to the file
  try {
    writeFileSync(filePath, jsonString, { encoding: "utf8" });
    console.log("Object has been written to", filePath);
  } catch (err) {
    console.error("Error writing to file:", err);
  }
}

function cleanObj(object) {
  const newObj = { file: object.file, records: null };
  const records = new Array();
  for (const record of object.records) {
    const newRecord = {
      srcName: record.srcName,
    };
    for (const setName of Object.keys(record.imageSizes)) {
      newRecord[setName] = record.imageSizes[setName].width;
    }
    records.push(newRecord);
  }
  newObj.records = records;
  //new structure
  /* 
  {
    file:"xyz.html",
    records:[
      {
        srcName:"a.img"
        1X:xx,
        2X:xx,
        3X:xx,
        4X:xx,
        nX:xx,
      }, 
      etc
    ]
  }
  */
  return newObj;
}

/* PARAMETERS */
const filesGlob = "testmedia/webdoc/**.html";

async function comparator(nofSample) {
  let samples = new Array();

  //making number of samples by calling n of times
  for (let i = 0; i < nofSample; i++) {
    const sampleObjs = await htmlParser(filesGlob, screenSizes);
    const cleansampleObjs = new Array();
    for (const obj of sampleObjs) {
      cleansampleObjs.push(cleanObj(obj));
    }
    samples = samples.concat([{ sampleNo: i + 1, data: cleansampleObjs }]);
  }

  /* writeObjectToFile(samples, "./reportOBJ.json"); */
  //comparing sample with its siblings
  if (samples.every((sample) => _.isEqual(sample.data, samples[0].data))) {
    /* console.log("Every samples are same \n", samples); */
    return true;
  } else {
    const distinctSamples = samples.filter(
      (sample) => !_.isEqual(sample.data, samples[0].data)
    );
    console.log("Distinct Samples are below\n", distinctSamples);
    return false;
  }
}

test("HTML Parser Test", async () => {
  expect(await comparator(5)).toBe(true);
}, 500000);
