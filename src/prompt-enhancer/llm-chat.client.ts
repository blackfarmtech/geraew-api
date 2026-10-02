import {
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

/** Modelo padrão do chat. Sobrescrevível por LLM_CHAT_MODEL no .env. */
export const DEFAULT_LLM_CHAT_MODEL = 'claude-opus-5-5';

/**
 * Teto de tokens de saída. Nos modelos atuais o thinking é sempre ligado e
 * conta dentro de max_tokens — um teto baixo (os 1.500 que usávamos no Gemini)
 * corta a resposta no meio. 16k mantém a requisição não-streaming dentro do
 * timeout do SDK.
 */
const DEFAULT_MAX_TOKENS = 16_000;

const REQUEST_TIMEOUT_MS = 120_000;

const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;
type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

/**
 * Modelos que aceitam o fallback server-side `fallbacks: "default"`: se o
 * classificador de segurança recusar, a própria API reroda o pedido num modelo
 * alternativo na mesma chamada.
 */
const FALLBACK_MODELS = new Set([
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-fable-5-1',
  'claude-sonnet-5-5',
]);
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export interface ChatPart {
  text?: string;
  inline_data?: { base64: string; mime_type: string };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  parts: ChatPart[];
}

/** Profundidade de raciocínio — mapeado para `output_config.effort`. */
export type ChatEffort = 'low' | 'medium' | 'high';

export interface ChatRequest {
  messages: ChatMessage[];
  system_instruction?: string;
  model?: string;
  max_tokens?: number;
  effort?: ChatEffort;
  /** Rótulo de quem originou a chamada — só para log, não vai no body. */
  caller?: string;
}

export interface ChatResponse {
  text: string;
  /** stop_reason da API: 'end_turn' | 'max_tokens' | 'refusal' | ... */
  stopReason: string | null;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

type FallbackMessageCreateParams =
  Anthropic.Beta.MessageCreateParamsNonStreaming & {
    // Ainda não tipado no @anthropic-ai/sdk 0.80 — o SDK repassa o campo no body.
    fallbacks?: 'default';
  };

/**
 * Cliente de chat LLM (Claude, via API da Anthropic). Substitui o antigo
 * GeraewChatClient, que falava com o Gemini através do Geraew Provider/Vertex.
 */
@Injectable()
export class LlmChatClient {
  private readonly logger = new Logger(LlmChatClient.name);
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private client: Anthropic | null = null;

  constructor(configService: ConfigService) {
    this.apiKey = (configService.get<string>('ANTHROPIC_API_KEY') ?? '').trim();
    this.defaultModel =
      configService.get<string>('LLM_CHAT_MODEL')?.trim() ||
      DEFAULT_LLM_CHAT_MODEL;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const origin = req.caller ?? 'unknown';
    const model = req.model || this.defaultModel;
    const client = this.getClient(origin);

    const params: FallbackMessageCreateParams = {
      model,
      max_tokens: req.max_tokens ?? DEFAULT_MAX_TOKENS,
      messages: req.messages.map((m) => this.toMessageParam(m)),
      ...(req.system_instruction
        ? {
            system: [
              {
                type: 'text' as const,
                text: req.system_instruction,
                cache_control: { type: 'ephemeral' as const },
              },
            ],
          }
        : {}),
      ...(this.supportsEffort(model)
        ? { output_config: { effort: req.effort ?? 'medium' } }
        : {}),
      ...(FALLBACK_MODELS.has(model)
        ? { betas: [FALLBACK_BETA], fallbacks: 'default' as const }
        : {}),
    };

    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await client.beta.messages.create(params);
    } catch (error) {
      throw this.toHttpException(error, origin, model);
    }

    const usage = response.usage;
    this.logger.debug(
      `[${origin}] ${response.model} stop=${response.stop_reason} ` +
        `in=${usage.input_tokens} out=${usage.output_tokens} ` +
        `cache_read=${usage.cache_read_input_tokens ?? 0}`,
    );

    if (response.stop_reason === 'refusal') {
      this.logger.warn(
        `[${origin}] ${response.model} recusou o pedido (stop_reason=refusal)`,
      );
      return {
        text: '',
        stopReason: response.stop_reason,
        model: response.model,
        usage: {
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
        },
      };
    }

    const text = response.content
      .filter(
        (block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text',
      )
      .map((block) => block.text)
      .join('');

    return {
      text,
      stopReason: response.stop_reason,
      model: response.model,
      usage: {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
      },
    };
  }

  private getClient(origin: string): Anthropic {
    if (this.client) return this.client;
    if (!this.apiKey) {
      this.logger.error(
        `[${origin}] ANTHROPIC_API_KEY não configurada — chat LLM indisponível`,
      );
      throw new ServiceUnavailableException(
        'Serviço de IA indisponível no momento. Tente novamente em instantes.',
      );
    }
    this.client = new Anthropic({
      apiKey: this.apiKey,
      timeout: REQUEST_TIMEOUT_MS,
      maxRetries: 2,
    });
    return this.client;
  }

  /** Haiku 4.5 e Sonnet 4.5 não aceitam `effort` (400). */
  private supportsEffort(model: string): boolean {
    return !/haiku|sonnet-4-5/.test(model);
  }

  private toMessageParam(
    message: ChatMessage,
  ): Anthropic.Beta.BetaMessageParam {
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    for (const part of message.parts) {
      if (part.inline_data) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: this.toImageMediaType(part.inline_data.mime_type),
            data: part.inline_data.base64,
          },
        });
      }
      if (part.text) {
        content.push({ type: 'text', text: part.text });
      }
    }
    return { role: message.role, content };
  }

  private toImageMediaType(mimeType: string): SupportedImageType {
    const normalized = mimeType.toLowerCase().split(';')[0].trim();
    if ((SUPPORTED_IMAGE_TYPES as readonly string[]).includes(normalized)) {
      return normalized as SupportedImageType;
    }
    throw new BadRequestException({
      code: 'INVALID_IMAGE_FORMAT',
      message: `Tipo de imagem não suportado: ${mimeType || 'desconhecido'}. Use JPEG, PNG, GIF ou WebP.`,
    });
  }

  private toHttpException(
    error: unknown,
    origin: string,
    model: string,
  ): Error {
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      this.logger.error(
        `[${origin}] Anthropic não respondeu em ${REQUEST_TIMEOUT_MS / 1000}s (model=${model})`,
      );
      return new GatewayTimeoutException(
        'O serviço de IA demorou demais para responder. Tente novamente.',
      );
    }
    if (error instanceof Anthropic.APIConnectionError) {
      this.logger.error(
        `[${origin}] falha de rede ao chamar a Anthropic (model=${model}): ${error.message}`,
      );
      return new ServiceUnavailableException(
        'Serviço de IA indisponível no momento. Tente novamente em instantes.',
      );
    }
    if (
      error instanceof Anthropic.RateLimitError ||
      error instanceof Anthropic.InternalServerError
    ) {
      this.logger.error(
        `[${origin}] Anthropic respondeu HTTP ${error.status} (model=${model}): ${error.message}`,
      );
      return new ServiceUnavailableException(
        'Serviço de IA sobrecarregado no momento. Tente novamente em instantes.',
      );
    }
    if (error instanceof Anthropic.APIError) {
      this.logger.error(
        `[${origin}] Anthropic respondeu HTTP ${error.status} (model=${model}): ${error.message}`,
      );
      return new InternalServerErrorException(
        'Falha ao consultar o serviço de IA.',
      );
    }
    if (error instanceof Error) return error;
    return new InternalServerErrorException(
      'Falha ao consultar o serviço de IA.',
    );
  }
}
