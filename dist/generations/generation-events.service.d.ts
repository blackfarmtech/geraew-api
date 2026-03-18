import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
export interface GenerationEvent {
    userId: string;
    generationId: string;
    status: 'completed' | 'failed';
    data: Record<string, unknown>;
}
export declare class GenerationEventsService implements OnModuleInit, OnModuleDestroy {
    private readonly configService;
    private readonly logger;
    private readonly events$;
    private publisher;
    private subscriber;
    constructor(configService: ConfigService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    emit(event: GenerationEvent): void;
    subscribe(userId: string): Observable<MessageEvent>;
    subscribeToGeneration(userId: string, generationId: string): Observable<MessageEvent>;
}
