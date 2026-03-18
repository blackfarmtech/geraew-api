"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerationsModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const generations_controller_1 = require("./generations.controller");
const generations_service_1 = require("./generations.service");
const generation_events_service_1 = require("./generation-events.service");
const generation_processor_1 = require("./queue/generation.processor");
const generation_queue_constants_1 = require("./queue/generation-queue.constants");
const prisma_module_1 = require("../prisma/prisma.module");
const credits_module_1 = require("../credits/credits.module");
const plans_module_1 = require("../plans/plans.module");
const uploads_module_1 = require("../uploads/uploads.module");
const geraew_provider_1 = require("./providers/geraew.provider");
const nano_banana_provider_1 = require("./providers/nano-banana.provider");
let GenerationsModule = class GenerationsModule {
};
exports.GenerationsModule = GenerationsModule;
exports.GenerationsModule = GenerationsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            credits_module_1.CreditsModule,
            plans_module_1.PlansModule,
            uploads_module_1.UploadsModule,
            bullmq_1.BullModule.registerQueue({
                name: generation_queue_constants_1.GENERATION_QUEUE,
                defaultJobOptions: {
                    attempts: 2,
                    backoff: { type: 'fixed', delay: 30_000 },
                    removeOnComplete: { age: 24 * 3600 },
                    removeOnFail: { age: 7 * 24 * 3600 },
                },
            }),
        ],
        controllers: [generations_controller_1.GenerationsController],
        providers: [
            generations_service_1.GenerationsService,
            generation_events_service_1.GenerationEventsService,
            generation_processor_1.GenerationProcessor,
            geraew_provider_1.GeraewProvider,
            nano_banana_provider_1.NanoBananaProvider,
        ],
        exports: [generations_service_1.GenerationsService],
    })
], GenerationsModule);
//# sourceMappingURL=generations.module.js.map