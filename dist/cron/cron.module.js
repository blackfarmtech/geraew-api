"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronModule = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const subscription_renewal_service_1 = require("./subscription-renewal.service");
const payment_retry_service_1 = require("./payment-retry.service");
const gallery_cleanup_service_1 = require("./gallery-cleanup.service");
const stuck_generations_service_1 = require("./stuck-generations.service");
let CronModule = class CronModule {
};
exports.CronModule = CronModule;
exports.CronModule = CronModule = __decorate([
    (0, common_1.Module)({
        imports: [schedule_1.ScheduleModule.forRoot()],
        providers: [
            subscription_renewal_service_1.SubscriptionRenewalService,
            payment_retry_service_1.PaymentRetryService,
            gallery_cleanup_service_1.GalleryCleanupService,
            stuck_generations_service_1.StuckGenerationsService,
        ],
    })
], CronModule);
//# sourceMappingURL=cron.module.js.map