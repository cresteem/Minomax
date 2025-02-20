#!/usr/bin/env node

import { Command } from "commander";

import { terminate } from "../lib/utils";
import iconAssociator from "./iconAssociator";
import initConfig from "./initConfig";

import { Minomax } from "../minomax";
const minomax = new Minomax();

const program = new Command();
const { destPath } = minomax.configurations;

// Minomax command
program
	.command("prod")
	.description("Run the minomax process")
	.option(
		"-f, --format [jpg | avif | webp | svg]",
		"Image output format",
		"webp",
	)
	.option(
		"-c, --codec [wav1 | mav1 | mx265]",
		"Video output codec type",
		"wav1",
	)
	.option("-e, --encode [1 | 2 | 3]", "Video encoding level", parseInt, 3)
	.option(
		"-i, --ignore <patterns>",
		"Ignore path patterns",
		(value) => value.split(","),
		[],
	)
	.action(async (options) => {
		await minomax.minomax({
			imageWorkerParams: { targetFormat: options.format },
			videoWorkerParams: {
				codecType: options.codec,
				encodeLevel: options.encode,
			},
			ignorePatterns: options.ignore,
		});
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
		await minomax.compressImages({
			lookUpPatterns: options.patterns,
			targetFormat: options.format,
			destinationBasePath: options.dest,
			ignorePatterns: options.ignore,
		});
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
		"-i, --ignore <patterns>",
		"Ignore patterns",
		(value) => value.split(","),
		[],
	)
	.action(async (options) => {
		await minomax.compressVideos({
			lookUpPatterns: options.patterns,
			codecType: options.codec,
			encodeLevel: options.encode,
			destinationBasePath: options.dest,
			ignorePatterns: options.ignore,
		});
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
		await minomax.minifyWebdoc({
			lookUpPatterns: options.patterns,
			destinationBasePath: options.dest,
			lookUpBasePath: options.searchBase,
			ignorePatterns: options.ignore,
		});
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
		await minomax.generateImageSets({
			lookUpPatterns: options.patterns,
			destinationBasePath: options.dest,
			ignorePatterns: options.ignore,
		});
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
