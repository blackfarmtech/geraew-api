"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerationEventsService = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
let GenerationEventsService = class GenerationEventsService {
    events$ = new rxjs_1.Subject();
    emit(event) {
        this.events$.next(event);
    }
    subscribe(userId) {
        return this.events$.pipe((0, rxjs_1.filter)((event) => event.userId === userId));
    }
    subscribeToGeneration(userId, generationId) {
        return this.events$.pipe((0, rxjs_1.filter)((event) => event.userId === userId && event.generationId === generationId));
    }
};
exports.GenerationEventsService = GenerationEventsService;
exports.GenerationEventsService = GenerationEventsService = __decorate([
    (0, common_1.Injectable)()
], GenerationEventsService);
//# sourceMappingURL=generation-events.service.js.map