import { Observable } from 'rxjs';
export interface GenerationEvent {
    userId: string;
    generationId: string;
    status: 'completed' | 'failed';
    data: Record<string, unknown>;
}
export declare class GenerationEventsService {
    private readonly events$;
    emit(event: GenerationEvent): void;
    subscribe(userId: string): Observable<MessageEvent>;
    subscribeToGeneration(userId: string, generationId: string): Observable<MessageEvent>;
}
