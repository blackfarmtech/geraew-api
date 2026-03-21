"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptEnhancerController = void 0;
const common_1 = require("@nestjs/common");
const prompt_enhancer_service_1 = require("./prompt-enhancer.service");
const enhance_prompt_dto_1 = require("./dto/enhance-prompt.dto");
const enhance_influencer_dto_1 = require("./dto/enhance-influencer.dto");
let PromptEnhancerController = class PromptEnhancerController {
    promptEnhancerService;
    constructor(promptEnhancerService) {
        this.promptEnhancerService = promptEnhancerService;
    }
    async enhance(dto) {
        const result = await this.promptEnhancerService.enhance(dto.prompt, dto.context, dto.images);
        return {
            enhancedPrompt: result.prompt,
            negativePrompt: result.negativePrompt,
        };
    }
    async enhanceInfluencer(dto) {
        const enhancedPrompt = await this.promptEnhancerService.enhanceInfluencer(dto);
        return { enhancedPrompt };
    }
};
exports.PromptEnhancerController = PromptEnhancerController;
__decorate([
    (0, common_1.Post)('enhance'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [enhance_prompt_dto_1.EnhancePromptDto]),
    __metadata("design:returntype", Promise)
], PromptEnhancerController.prototype, "enhance", null);
__decorate([
    (0, common_1.Post)('enhance-influencer'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [enhance_influencer_dto_1.EnhanceInfluencerDto]),
    __metadata("design:returntype", Promise)
], PromptEnhancerController.prototype, "enhanceInfluencer", null);
exports.PromptEnhancerController = PromptEnhancerController = __decorate([
    (0, common_1.Controller)('api/v1/prompt-enhancer'),
    __metadata("design:paramtypes", [prompt_enhancer_service_1.PromptEnhancerService])
], PromptEnhancerController);
//# sourceMappingURL=prompt-enhancer.controller.js.map