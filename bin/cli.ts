#!/usr/bin/env node

import { Command } from "commander";
import configurations from "../configLoader";
import {
	compressImages,
	compressVideos,
	generateImageSets,
	minifyWebdoc,
	minomax,
} from "../minomax";

import { terminate } from "lib/utils";
import iconAssociator from "./iconAssociator";
import initConfig from "./initConfig";

const program = new Command();
const { destPath } = configurations();

// Minomax command
program
	.command("make")
	.description("Run the minomax process")
	.option(
		"-f, --format [jpg | avif | webp]",
		"Image output format",
		"webp",
	)
	.option(
		"-c, --codec [wav1 | mav1 | mx265]",
		"Output video codec type",
		"wav1",
	)
	.option("-e, --encode [1 | 2 | 3]", "Video encoding level", parseInt, 3)
	.option("-d, --dest <path>", "Destination base path", destPath)
	.option(
		"-i, --ignore <patterns>",
		"Ignore path patterns",
		(value) => value.split(","),
		[],
	)
	.action(async (options) => {
		await minomax(
			{ targetFormat: options.format },
			{ codecType: options.codec, encodeLevel: options.encode },
			options.dest,
			options.ignore,
		);
	});

// Compress Images command
program
	.command("image")
	.description("Compress images")
	.option(
		"-p, --patterns <patterns>",
		"Path patterns",
		(value) => value.split(","),
		[],
	)
	.option(
		"-f, --format [jpg | avif | webp]",
		"Image output format",
		"webp",
	)
	.option("-d, --dest <path>", "Destination base path", destPath)
	.option(
		"-i, --ignore <patterns>",
		"Ignore patterns",
		(value) => value.split(","),
		[],
	)
	.action(async (options) => {
		await compressImages(
			options.patterns,
			options.format,
			options.dest,
			options.ignore,
		);
	});

// Compress Videos command
program
	.command("video")
	.description("Compress videos")
	.option(
		"-p, --patterns <patterns>",
		"Path patterns",
		(value) => value.split(","),
		[],
	)
	.option(
		"-c, --codec [wav1 | mav1 | mx265]",
		"Output video codec type",
		"wav1",
	)
	.option("-e, --encode [1 | 2 | 3]", "Video encoding level", parseInt, 3)
	.option("-d, --dest <path>", "Destination base path", destPath)
	.option(
		"-I, --ignore <patterns>",
		"Ignore patterns",
		(value) => value.split(","),
		[],
	)
	.action(async (options) => {
		await compressVideos(
			options.patterns,
			options.codec,
			options.encode,
			options.dest,
			options.ignore,
		);
	});

// Minify Webdoc command
program
	.command("minify")
	.description("Minify web documents - JS , CSS & HTML")
	.option(
		"-p, --patterns <patterns>",
		"Path patterns",
		(value) => value.split(","),
		[],
	)
	.option("-d, --dest <path>", "Destination base path", destPath)
	.option(
		"-s, --searchBase <path>",
		"File search base path",
		process.cwd(),
	)
	.option(
		"-i, --ignore <patterns>",
		"Ignore patterns",
		(value) => value.split(","),
		[],
	)
	.action(async (options) => {
		await minifyWebdoc(
			options.patterns,
			options.dest,
			options.searchBase,
			options.ignore,
		);
	});

// Generate Image Sets command
program
	.command("genset")
	.description("Generate image sets")
	.option(
		"-p, --patterns <patterns>",
		"Path patterns",
		(value) => value.split(","),
		[],
	)
	.option("-d, --dest <path>", "Destination base path", destPath)
	.option(
		"-i, --ignore <patterns>",
		"Ignore patterns",
		(value) => value.split(","),
		[],
	)
	.action(async (options) => {
		await generateImageSets(
			options.patterns,
			options.dest,
			options.ignore,
		);
	});

// Init config template
program
	.command("init")
	.description("Init configuration template")
	.action(async () => {
		try {
			initConfig();
			console.log("🚀 Minomax configuration initialised.");

			await iconAssociator();
		} catch (err) {
			terminate({
				reason: "⚠️ Error initializing icon associations:\t" + err,
			});
		}
	});

program.parse(process.argv);
