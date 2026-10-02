import {
  BadRequestException,
  GatewayTimeoutException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_LLM_CHAT_MODEL, LlmChatClient } from '../llm-chat.client';

function buildClient(
  env: Record<string, string | undefined> = { ANTHROPIC_API_KEY: 'test-key' },
) {
  const config = {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService;
  const llm = new LlmChatClient(config);
  const create = jest.fn<Promise<unknown>, [Record<string, unknown>]>();
  // Injeta um SDK falso — nenhum teste faz chamada real à API.
  (llm as unknown as { client: unknown }).client = {
    beta: { messages: { create } },
  };
  return { llm, create };
}

function message(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: DEFAULT_LLM_CHAT_MODEL,
    stop_reason: 'end_turn',
    content: [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'text', text: '{"prompt":' },
      { type: 'text', text: '"ok"}' },
    ],
    usage: { input_tokens: 120, output_tokens: 40, cache_read_input_tokens: 0 },
    ...overrides,
  };
}

describe('LlmChatClient', () => {
  it('converte o pedido para a Messages API e junta os blocos de texto', async () => {
    const { llm, create } = buildClient();
    create.mockResolvedValue(message());

    const res = await llm.chat({
      caller: 'test',
      system_instruction: 'SYSTEM',
      effort: 'low',
      messages: [
        {
          role: 'user',
          parts: [
            { inline_data: { base64: 'AAAA', mime_type: 'image/jpeg' } },
            { text: 'descreva' },
          ],
        },
      ],
    });

    expect(res).toEqual({
      text: '{"prompt":"ok"}',
      stopReason: 'end_turn',
      model: DEFAULT_LLM_CHAT_MODEL,
      usage: { inputTokens: 120, outputTokens: 40 },
    });

    const params = create.mock.calls[0][0];
    expect(params).toMatchObject({
      model: DEFAULT_LLM_CHAT_MODEL,
      max_tokens: 16000,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [
        { type: 'text', text: 'SYSTEM', cache_control: { type: 'ephemeral' } },
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: 'AAAA',
              },
            },
            { type: 'text', text: 'descreva' },
          ],
        },
      ],
    });
    // Modelos atuais rejeitam sampling params e thinking desligado.
    expect(params).not.toHaveProperty('temperature');
    expect(params).not.toHaveProperty('thinking');
    expect(params).not.toHaveProperty('caller');
  });

  it('usa LLM_CHAT_MODEL e omite effort/fallback em modelos que não suportam', async () => {
    const { llm, create } = buildClient({
      ANTHROPIC_API_KEY: 'k',
      LLM_CHAT_MODEL: 'claude-haiku-4-5',
    });
    create.mockResolvedValue(message({ model: 'claude-haiku-4-5' }));

    await llm.chat({ messages: [{ role: 'user', parts: [{ text: 'oi' }] }] });

    const params = create.mock.calls[0][0];
    expect(params.model).toBe('claude-haiku-4-5');
    expect(params).not.toHaveProperty('output_config');
    expect(params).not.toHaveProperty('fallbacks');
    expect(params).not.toHaveProperty('betas');
    expect(params).not.toHaveProperty('system');
  });

  it('usa effort medium por padrão', async () => {
    const { llm, create } = buildClient();
    create.mockResolvedValue(message());

    await llm.chat({ messages: [{ role: 'user', parts: [{ text: 'oi' }] }] });

    expect(create.mock.calls[0][0].output_config).toEqual({ effort: 'medium' });
  });

  it('devolve texto vazio quando o modelo recusa', async () => {
    const { llm, create } = buildClient();
    create.mockResolvedValue(
      message({
        stop_reason: 'refusal',
        content: [{ type: 'text', text: 'parcial' }],
      }),
    );

    const res = await llm.chat({
      messages: [{ role: 'user', parts: [{ text: 'x' }] }],
    });

    expect(res.text).toBe('');
    expect(res.stopReason).toBe('refusal');
  });

  it('expõe stop_reason max_tokens para o chamador detectar truncamento', async () => {
    const { llm, create } = buildClient();
    create.mockResolvedValue(message({ stop_reason: 'max_tokens' }));

    const res = await llm.chat({
      messages: [{ role: 'user', parts: [{ text: 'x' }] }],
    });

    expect(res.stopReason).toBe('max_tokens');
  });

  it('rejeita tipo de imagem não suportado antes de chamar a API', async () => {
    const { llm, create } = buildClient();

    await expect(
      llm.chat({
        messages: [
          {
            role: 'user',
            parts: [{ inline_data: { base64: 'AA', mime_type: 'image/heic' } }],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('falha com 503 quando ANTHROPIC_API_KEY não está configurada', async () => {
    const config = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;
    const llm = new LlmChatClient(config);

    await expect(
      llm.chat({ messages: [{ role: 'user', parts: [{ text: 'x' }] }] }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  describe('mapeamento de erros do SDK', () => {
    const cases: Array<
      [string, () => unknown, new (...args: never[]) => Error]
    > = [
      [
        'timeout → 504',
        () => new Anthropic.APIConnectionTimeoutError(),
        GatewayTimeoutException,
      ],
      [
        'rede → 503',
        () => new Anthropic.APIConnectionError({ message: 'ECONNRESET' }),
        ServiceUnavailableException,
      ],
      [
        '429 → 503',
        () =>
          Anthropic.APIError.generate(429, {}, 'rate limited', new Headers()),
        ServiceUnavailableException,
      ],
      [
        '529 → 503',
        () => Anthropic.APIError.generate(529, {}, 'overloaded', new Headers()),
        ServiceUnavailableException,
      ],
      [
        '400 → 500',
        () =>
          Anthropic.APIError.generate(400, {}, 'bad request', new Headers()),
        InternalServerErrorException,
      ],
    ];

    it.each(cases)('%s', async (_label, makeError, expected) => {
      const { llm, create } = buildClient();
      create.mockRejectedValue(makeError());

      await expect(
        llm.chat({ messages: [{ role: 'user', parts: [{ text: 'x' }] }] }),
      ).rejects.toBeInstanceOf(expected);
    });
  });
});
