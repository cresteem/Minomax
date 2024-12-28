import { ConfigurationOptions } from "./lib/types";

const defaultConfig: ConfigurationOptions = {
	imageWorker: {
		encoding: {
			targetType: "webp",
			jpgEncodeOptions: {
				mozjpeg: {
					quality: 60,
					color_space: 3,
					auto_subsample: false,
					chroma_subsample: 4,
					progressive: true,
					smoothing: 0,
					quant_table: 2,
					trellis_multipass: true,
					trellis_opt_zero: true,
					trellis_opt_table: true,
					trellis_loops: 50,
					separate_chroma_quality: false,
					chroma_quality: 75,
				},
			},
			webpEncodeOptions: {
				webp: {
					method: 6,
					quality: 50,
					alpha_compression: 1,
					alpha_quality: 100,
					alpha_filtering: 0,
					autofilter: 0,
					filter_strength: 0,
					filter_type: 0,
					filter_sharpness: 7,
					pass: 10,
					use_sharp_yuv: 0,
					sns_strength: 0,
					preprocessing: 1,
					segments: 4,
					partitions: 3,
				},
			},
			avifEncodeOptions: {
				avif: {
					cqLevel: 35,
					subsample: 1,
					cqAlphaLevel: -1,
					chromaDeltaQ: true,
					sharpness: 0,
					denoiseLevel: 0,
					tune: 2,
					speed: 0,
				},
			},
			svgOptions: {
				multipass: true,
				plugins: [
					{
						name: "preset-default",
						params: {
							overrides: {
								removeDoctype: true,
								removeXMLProcInst: true,
								removeComments: true,
								removeMetadata: true,
								removeEditorsNSData: true,
								cleanupAttrs: true,
								mergeStyles: true,
								inlineStyles: true,
								minifyStyles: true,
								cleanupIds: true,
								removeUselessDefs: true,
								cleanupNumericValues: true,
								convertColors: true,
								removeUnknownsAndDefaults: true,
								removeNonInheritableGroupAttrs: true,
								removeUselessStrokeAndFill: true,
								removeViewBox: false,
								cleanupEnableBackground: true,
								removeHiddenElems: true,
								removeEmptyText: true,
								convertShapeToPath: true,
								moveElemsAttrsToGroup: true,
								moveGroupAttrsToElems: false,
								collapseGroups: true,
								convertPathData: true,
								convertEllipseToCircle: true,
								convertTransform: true,
								removeEmptyAttrs: true,
								removeEmptyContainers: true,
								mergePaths: true,
								removeUnusedNS: true,
								sortAttrs: true,
								sortDefsChildren: true,
								removeTitle: true,
								removeDesc: true,
							},
							floatPrecision: 1,
							transformPrecision: 0,
							leadingZero: false,
						},
					},
					{
						name: "cleanupListOfValues",
						params: {
							floatPrecision: 1,
							leadingZero: false,
						},
					},
					"removeRasterImages",
					"reusePaths",
					"removeScriptElement",
					"removeOffCanvasPaths",
					"removeDimensions",
				],
			},
		},
		set: {
			screenSizes: {
				xs: 400,
				sm: 640,
				md: 768,
				lg: 1024,
				xl: 1280,
				xxl: 1536,
				xxxl: 3172,
			},
			upscaleLevel: 2,
		},
	},
	videoWorker: {
		encoding: { encodeLevel: 2, codecType: "mx265" },
	},
	webDoc: {
		htmloptions: {
			removeComments: true,
			removeRedundantAttributes: true,
			collapseWhitespace: true,
			html5: true,
			minifyCSS: true,
			minifyJS: true,
			quoteCharacter: "'",
			removeEmptyAttributes: true,
			removeScriptTypeAttributes: true,
			removeStyleLinkTypeAttributes: true,
			removeTagWhitespace: true,
		},
	},
	lookUpPatterns: {
		webDoc: ["**/*.css", "**/*.js", "**/*.html", "**/*.htm"],
		image: ["**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.bmp", "**/*.webp"],
		video: [
			"**/*.mp4",
			"**/*.webm",
			"**/*.mkv",
			"**/*.wmv",
			"**/*.flv",
			"**/*.avi",
			"**/*.mov",
		],
	},
	ignorePatterns: ["node_modules/**"],
	destPath: "./minomax-output",
	removeOld: true,
};

export default defaultConfig;
