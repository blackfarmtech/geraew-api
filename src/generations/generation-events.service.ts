import { Injectable } from '@nestjs/common';
import { Subject, Observable, filter } from 'rxjs';

export interface GenerationEvent {
  userId: string;
  generationId: string;
  status: 'completed' | 'failed';
  data: Record<string, unknown>;
}

@Injectable()
export class GenerationEventsService {
  private readonly events$ = new Subject<GenerationEvent>();

  emit(event: GenerationEvent): void {
    this.events$.next(event);
  }

  subscribe(userId: string): Observable<MessageEvent> {
    return this.events$.pipe(
      filter((event) => event.userId === userId),
    ) as unknown as Observable<MessageEvent>;
  }

  subscribeToGeneration(
    userId: string,
    generationId: string,
  ): Observable<MessageEvent> {
    return this.events$.pipe(
      filter(
        (event) =>
          event.userId === userId && event.generationId === generationId,
      ),
    ) as unknown as Observable<MessageEvent>;
  }
}
