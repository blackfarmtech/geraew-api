"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VIDEO_JOB_TIMEOUT = exports.IMAGE_JOB_TIMEOUT = exports.GenerationJobName = exports.GENERATION_QUEUE = void 0;
exports.GENERATION_QUEUE = 'generation';
var GenerationJobName;
(function (GenerationJobName) {
    GenerationJobName["IMAGE"] = "image";
    GenerationJobName["IMAGE_WITH_FALLBACK"] = "image-with-fallback";
    GenerationJobName["IMAGE_NANO_BANANA"] = "image-nano-banana";
    GenerationJobName["TEXT_TO_VIDEO"] = "text-to-video";
    GenerationJobName["IMAGE_TO_VIDEO"] = "image-to-video";
    GenerationJobName["REFERENCE_VIDEO"] = "reference-video";
    GenerationJobName["MOTION_CONTROL"] = "motion-control";
})(GenerationJobName || (exports.GenerationJobName = GenerationJobName = {}));
exports.IMAGE_JOB_TIMEOUT = 5 * 60 * 1000;
exports.VIDEO_JOB_TIMEOUT = 12 * 60 * 1000;
//# sourceMappingURL=generation-queue.constants.js.map