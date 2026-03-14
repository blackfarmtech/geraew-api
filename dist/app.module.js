"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const plans_module_1 = require("./plans/plans.module");
const users_module_1 = require("./users/users.module");
const jwt_auth_guard_1 = require("./common/guards/jwt-auth.guard");
const throttle_guard_1 = require("./common/guards/throttle.guard");
const uploads_module_1 = require("./uploads/uploads.module");
const webhook_logs_module_1 = require("./webhook-logs/webhook-logs.module");
const credits_module_1 = require("./credits/credits.module");
const subscriptions_module_1 = require("./subscriptions/subscriptions.module");
const admin_module_1 = require("./admin/admin.module");
const cron_module_1 = require("./cron/cron.module");
const payments_module_1 = require("./payments/payments.module");
const generations_module_1 = require("./generations/generations.module");
const gallery_module_1 = require("./gallery/gallery.module");
const folders_module_1 = require("./folders/folders.module");
const video_editor_module_1 = require("./video-editor/video-editor.module");
const prompt_enhancer_module_1 = require("./prompt-enhancer/prompt-enhancer.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            throttler_1.ThrottlerModule.forRoot({
                throttlers: [
                    {
                        name: 'default',
                        ttl: 60000,
                        limit: 30,
                    },
                ],
            }),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            plans_module_1.PlansModule,
            users_module_1.UsersModule,
            uploads_module_1.UploadsModule,
            webhook_logs_module_1.WebhookLogsModule,
            credits_module_1.CreditsModule,
            subscriptions_module_1.SubscriptionsModule,
            admin_module_1.AdminModule,
            cron_module_1.CronModule,
            payments_module_1.PaymentsModule,
            generations_module_1.GenerationsModule,
            gallery_module_1.GalleryModule,
            folders_module_1.FoldersModule,
            video_editor_module_1.VideoEditorModule,
            prompt_enhancer_module_1.PromptEnhancerModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [
            app_service_1.AppService,
            {
                provide: core_1.APP_GUARD,
                useClass: jwt_auth_guard_1.JwtAuthGuard,
            },
            {
                provide: core_1.APP_GUARD,
                useClass: throttle_guard_1.CustomThrottlerGuard,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map