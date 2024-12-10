interface mozjpegOptions {
	quality: number; //0-100
	color_space: number; //1-grayscale 2-rgb 3-Ycbcr
	auto_subsample: boolean;
	chroma_subsample: number; // 1-4
	progressive: boolean;
	smoothing: number; //0-100
	quant_table: number; //quantization: 2-MSSIM kodak ,3-ImageMagick, 4-PSNR kodak

	trellis_multipass: boolean;
	trellis_opt_zero: boolean; //optimize zero block run
	trellis_opt_table: boolean; //optimize after trellis
	trellis_loops: number; //quant passes 1-50

	separate_chroma_quality: boolean;
	chroma_quality: number; //set only if seperate cq is enabled
}

interface webpOption {
	method: number; //effort 0-6
	quality: number; //0-100
	alpha_compression: number; // 0 boolean / 1 boolean
	alpha_quality: number; //0-100
	alpha_filtering: number; //alpha filter quality 0-2
	autofilter: number; //auto adjust filter 0 boolean / 1 boolean
	filter_strength: number; //set if auto filter is 0 (0-100)
	filter_type: number; //strong filter 0 boolean / 1 boolean
	filter_sharpness: number; //0-7
	pass: number; //1-10
	use_sharp_yuv: number; //sharp RGB->YUV - 1 boolean / 0 boolean
	sns_strength: number; //spatial noise shaping 0-100
	preprocessing: number; //0-none / 1-segment smooth / 2- psuedo random dithering
	segments: number; // 0-4
	partitions: number; //0-3
}

interface avifOptions {
	cqLevel: number; //quality (62-0)
	subsample: number; //subsample chroma (1 / 0)
	cqAlphaLevel: number; //seperate alpha quality (62-0) / -1 for disable
	chromaDeltaQ: boolean; //extra chroma compression (boolean/boolean)
	sharpness: number; //0-7
	denoiseLevel: number; //0-50
	tune: number; //tune 0-auto/1-psnr/2-ssim
	speed: number; //max effort (10-0)
}

export interface jpgEncodeOptions {
	mozjpeg: mozjpegOptions;
}

export interface webpEncodeOptions {
	webp: webpOption;
}

export interface avifEncodeOptions {
	avif: avifOptions;
}

//svgo plugin options
interface svgoPresetDefault {
	name: "preset-default";
	params: {
		overrides: {
			// customize default plugin options
			removeDoctype: boolean;
			removeXMLProcInst: boolean;
			removeComments: boolean;
			removeMetadata: boolean;
			removeEditorsNSData: boolean;
			cleanupAttrs: boolean;
			mergeStyles: boolean;
			inlineStyles: boolean;
			minifyStyles: boolean;
			cleanupIds: boolean;
			removeUselessDefs: boolean;
			cleanupNumericValues: boolean;
			convertColors: boolean;
			removeUnknownsAndDefaults: boolean;
			removeNonInheritableGroupAttrs: boolean;
			removeUselessStrokeAndFill: boolean;
			removeViewBox: boolean;
			cleanupEnableBackground: boolean;
			removeHiddenElems: boolean;
			removeEmptyText: boolean;
			convertShapeToPath: boolean;
			moveElemsAttrsToGroup: boolean;
			moveGroupAttrsToElems: boolean;
			collapseGroups: boolean;
			convertPathData: boolean;
			convertEllipseToCircle: boolean;
			convertTransform: boolean;
			removeEmptyAttrs: boolean;
			removeEmptyContainers: boolean;
			mergePaths: boolean;
			removeUnusedNS: boolean;
			sortAttrs: boolean;
			sortDefsChildren: boolean;
			removeTitle: boolean;
			removeDesc: boolean;
		}; //overrides end
		floatPrecision: number;
		transformPrecision: number;
		leadingZero: boolean;
	}; //params end
}

interface svgoCleanupListOfValues {
	name: "cleanupListOfValues";
	params: { floatPrecision: number; leadingZero: boolean };
}

type svgoPlugings =
	| svgoPresetDefault
	| svgoCleanupListOfValues
	| "removeRasterImages"
	| "reusePaths"
	| "removeScriptElement"
	| "removeOffCanvasPaths"
	| "removeDimensions";

interface svgOptions {
	multipass: boolean;
	plugins: Partial<svgoPlugings>[];
}

type screenSizesOptions = "1X" | "2X" | "3X" | "4X" | "5X" | "6X";

interface imageSetConfigurations {
	/* 
	  Image set generator settings.
	  Sizes are width dependent.
	  Pixel unit is used in size.
	  Size always a upperlimit for each set (Example: x1:600) where 600px is upper limit
	  */
	screenSizes: Partial<Record<screenSizesOptions, number>>; //Screen sizes upper-limits
	upscaleLevel: "level1" | "level2" | "level3";
}

interface encodeOptions {
	jpgEncodeOptions: jpgEncodeOptions;
	webpEncodeOptions: webpEncodeOptions;
	avifEncodeOptions: avifEncodeOptions;
	svgOptions: svgOptions;
	cpuAllocation: number;
}

interface HtmlOptions {
	removeComments: boolean;
	removeRedundantAttributes: boolean;
	collapseWhitespace: boolean;
	html5: boolean;
	minifyCSS: boolean;
	minifyJS: boolean;
	quoteCharacter: string;
	removeEmptyAttributes: boolean;
	removeScriptTypeAttributes: boolean;
	removeStyleLinkTypeAttributes: boolean;
	removeTagWhitespace: boolean;
}

export interface ConfigurationOptions {
	encodeOptions: encodeOptions;
	imageSetConfigurations: imageSetConfigurations;
	destPath: string;
	webdoc: { htmloptions: HtmlOptions };
}

export type ImageWorkerOutputTypes = "jpg" | "avif" | "webp" | "svg";

export interface ImageTagsRecord {
	htmlFile: string;
	ImageRecords: SrcRecord[];
}

export class SrcRecord {
	imgTagReference: string;
	imageLink: string;
	id: string;
	classes: string[];
	imageSizes: Record<string, number>;
	attributes: ImageAttributes;

	constructor(
		imgTagReference: string,
		imageLink: string,
		id: string,
		classes: string[],
		imageSizes: Record<string, number>,
		attributes: ImageAttributes,
	) {
		this.imageLink = imageLink; //String
		this.id = id; //String
		this.classes = classes; //Array
		this.imageSizes = imageSizes;
		this.attributes = attributes;
		this.imgTagReference = imgTagReference;
	}
}

export interface ImageAttributes {
	id: string;
	class: string;
	alt: string;
	loading: string;
	style: string;
}

export interface PictureTagMakerResponse {
	imgTagReference: string;
	newTag: string;
}

export interface ImgTagTransResponse {
	htmlFilePath: string;
	updatedContent: string;
}

export type ImageSetRecordType = Record<
	string,
	{ path: string; width: number }
>;

export interface ImageSetGenRecord {
	baseImagePath: string;
	imageSet: ImageSetRecordType;
}

export interface UpscalerResponse {
	upscaledBaseimage: string;
	upscaledBaseimageWidth: number;
}

export interface WebDocFileListerResponse {
	cssContents: string;
	webDocFiles: string[];
}

export interface UniqueSelectorsResponse {
	uniqueClassNames: string[];
	uniqueIds: string[];
}

export interface SelectorExtractorResponse {
	uniqueClassNames: string[];
	uniqueIds: string[];
	webDocFiles: string[];
}

export interface NewNamesMakerResponse {
	newSelectorsRecords: Record<string, string>;
	webDocFiles: string[];
}

export interface ImageWorkerParamsMain {
	targetFormat: ImageWorkerOutputTypes;
}

export interface VideoWorkerParamsMain {
	codecType: "wav1" | "mav1" | "mx265";
	encodeLevel?: 1 | 2 | 3;
}
