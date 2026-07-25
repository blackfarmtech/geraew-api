import {
  Injectable,
  Logger,
  InternalServerErrorException,
  ServiceUnavailableException,
  GatewayTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatPart {
  text?: string;
  inline_data?: { base64: string; mime_type: string };
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: ChatPart[];
}

export interface ChatRequest {
  messages: ChatMessage[];
  system_instruction?: string;
  model?: string;
  temperature?: number;
  max_output_tokens?: number;
  thinking_level?: 'LOW' | 'MEDIUM' | 'HIGH';
  google_search?: boolean;
  /** Rótulo de quem originou a chamada — só para log, não vai no body. */
  caller?: string;
}

export interface ChatResponse {
  text: string;
  role: string;
  finishReason?: string;
  usage?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

@Injectable()
export class GeraewChatClient {
  private readonly logger = new Logger(GeraewChatClient.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(configService: ConfigService) {
    this.baseUrl = configService.get<string>('GERAEW_PROVIDER_URL', 'http://localhost:8012');
    this.apiKey = configService.get<string>('GERAEW_API_KEY', '');
    this.defaultModel = configService.get<string>('GERAEW_CHAT_MODEL', 'gemini-3.1-pro-preview');
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const { caller, ...payload } = req;
    const origin = caller ?? 'unknown';
    const url = `${this.baseUrl.replace(/\/+$/, '')}/api/chat`;
    const body = {
      ...payload,
      model: payload.model || this.defaultModel,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (error) {
        // Falha de transporte (provider fora do ar, DNS, timeout) — o fetch nativo
        // só diz "fetch failed", sem indicar quem chamou nem qual host.
        if (controller.signal.aborted) {
          this.logger.error(
            `[${origin}] geraew-provider não respondeu em 120s — ${url} (model=${body.model})`,
          );
          throw new GatewayTimeoutException(
            'O serviço de IA demorou demais para responder. Tente novamente.',
          );
        }
        this.logger.error(
          `[${origin}] falha de rede ao chamar o geraew-provider em ${url} (model=${body.model}): ` +
            `${this.describeNetworkError(error)}. ` +
            `Confira GERAEW_PROVIDER_URL no .env e se o geraew-provider está no ar.`,
        );
        throw new ServiceUnavailableException(
          'Serviço de IA indisponível no momento. Tente novamente em instantes.',
        );
      }

      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }

      if (!res.ok) {
        const msg = data?.message || data?.error?.message || data?.raw || `HTTP ${res.status}`;
        this.logger.error(
          `[${origin}] geraew-provider respondeu HTTP ${res.status} em ${url}: ` +
            `${typeof msg === 'string' ? msg : JSON.stringify(msg)}`,
        );
        throw new InternalServerErrorException(
          typeof msg === 'string' ? msg : 'Geraew chat request failed',
        );
      }

      return data as ChatResponse;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Extrai a causa real de um erro do fetch nativo. O undici embrulha falhas de
   * conexão num AggregateError dentro de `cause`, então o `message` sozinho é
   * sempre "fetch failed" — os códigos (ECONNREFUSED, ENOTFOUND, ...) só
   * aparecem se a gente descer na cadeia.
   */
  private describeNetworkError(error: unknown): string {
    const err = error as { message?: string; cause?: any };
    const cause = err?.cause;
    const codes = new Set<string>();

    if (cause?.code) codes.add(String(cause.code));
    if (Array.isArray(cause?.errors)) {
      for (const inner of cause.errors) {
        if (inner?.code) codes.add(String(inner.code));
      }
    }

    const detail = codes.size > 0 ? ` [${[...codes].join(', ')}]` : '';
    return `${err?.message ?? String(error)}${detail}`;
  }
}
