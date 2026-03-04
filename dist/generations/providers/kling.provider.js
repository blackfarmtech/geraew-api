"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var KlingProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KlingProvider = void 0;
const common_1 = require("@nestjs/common");
const base_provider_1 = require("./base.provider");
let KlingProvider = KlingProvider_1 = class KlingProvider extends base_provider_1.BaseProvider {
    logger = new common_1.Logger(KlingProvider_1.name);
    async generate(input) {
        this.logger.log(`[MVP Stub] Generating motion control video with Kling 2.6 — ${input.resolution} ${input.durationSeconds}s`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return {
            outputUrl: `https://mock-cdn.example.com/generations/${input.id}/output.mp4`,
            thumbnailUrl: `https://mock-cdn.example.com/generations/${input.id}/thumbnail.jpg`,
            modelUsed: 'kling-2.6',
        };
    }
};
exports.KlingProvider = KlingProvider;
exports.KlingProvider = KlingProvider = KlingProvider_1 = __decorate([
    (0, common_1.Injectable)()
], KlingProvider);
//# sourceMappingURL=kling.provider.js.map