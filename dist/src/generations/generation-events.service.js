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
var GenerationEventsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerationEventsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
const ioredis_1 = require("ioredis");
const CHANNEL = 'generation-events';
let GenerationEventsService = GenerationEventsService_1 = class GenerationEventsService {
    configService;
    logger = new common_1.Logger(GenerationEventsService_1.name);
    events$ = new rxjs_1.Subject();
    publisher;
    subscriber;
    constructor(configService) {
        this.configService = configService;
    }
    onModuleInit() {
        const redisUrl = this.configService.getOrThrow('REDIS_URL');
        this.publisher = new ioredis_1.default(redisUrl);
        this.subscriber = new ioredis_1.default(redisUrl);
        this.subscriber.subscribe(CHANNEL);
        this.subscriber.on('message', (_channel, message) => {
            try {
                const event = JSON.parse(message);
                this.events$.next(event);
            }
            catch {
            }
        });
        this.logger.log('Redis Pub/Sub connected for generation events');
    }
    onModuleDestroy() {
        this.subscriber?.unsubscribe(CHANNEL);
        this.subscriber?.disconnect();
        this.publisher?.disconnect();
    }
    emit(event) {
        this.publisher.publish(CHANNEL, JSON.stringify(event));
    }
    subscribe(userId) {
        return this.events$.pipe((0, rxjs_1.filter)((event) => event.userId === userId));
    }
    subscribeToGeneration(userId, generationId) {
        return this.events$.pipe((0, rxjs_1.filter)((event) => event.userId === userId && event.generationId === generationId));
    }
};
exports.GenerationEventsService = GenerationEventsService;
exports.GenerationEventsService = GenerationEventsService = GenerationEventsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GenerationEventsService);
//# sourceMappingURL=generation-events.service.js.map