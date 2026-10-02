import { ForbiddenException } from '@nestjs/common';
import { FreeGenerationType, Resolution } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { GenerationsService } from '../generations.service';
import { GenerationProcessor } from '../queue/generation.processor';
import { GenerationJobName } from '../queue/generation-queue.constants';
import { VeoProvider } from '../providers/veo.provider';

/**
 * Vertex saiu do produto: o Veo 3.1 roda só pelo KIE. Estes testes cobrem os
 * endpoints legados encaminhando pro KIE, o preço decidido no servidor, as
 * gerações grátis no Veo 3.1 Fast e o processor sem caminho da Vertex.
 */

const kieResponse = { id: 'gen-1', status: 'PROCESSING', creditsConsumed: 810 };

function makeService(overrides: Record<string, unknown> = {}) {
  const svc: any = Object.create(GenerationsService.prototype);
  svc.generateTextToVideoKie = jest.fn().mockResolvedValue(kieResponse);
  svc.generateImageToVideoKie = jest.fn().mockResolvedValue(kieResponse);
  svc.generateReferenceToVideoKie = jest.fn().mockResolvedValue(kieResponse);
  Object.assign(svc, overrides);
  return svc;
}

describe('Endpoints legados de vídeo → Veo 3.1 (KIE)', () => {
  it.each([
    ['geraew-fast', 'veo3_fast'],
    ['veo-3.1-fast-generate-001', 'veo3_fast'],
    ['geraew-quality', 'veo3'],
    ['veo-3.1-generate-001', 'veo3'],
    ['veo3_fast', 'veo3_fast'],
    ['veo3', 'veo3'],
  ])('text-to-video com model=%s vira o KIE %s', async (legacy, kie) => {
    const svc = makeService();
    const res = await svc.generateTextToVideo('user-1', {
      prompt: 'um gato',
      model: legacy,
      resolution: Resolution.RES_1080P,
      duration_seconds: 6,
      sample_count: 3,
      negative_prompt: 'blur',
      generate_audio: false,
      aspect_ratio: '9:16',
    });

    expect(res).toBe(kieResponse);
    // Campos que o Veo do KIE não tem (duração, amostras, negative, áudio) não passam adiante.
    expect(svc.generateTextToVideoKie).toHaveBeenCalledWith('user-1', {
      prompt: 'um gato',
      model: kie,
      resolution: Resolution.RES_1080P,
      aspect_ratio: '9:16',
    });
  });

  it('image-to-video sem model usa o Veo 3.1 Quality e repassa os frames', async () => {
    const svc = makeService();
    await svc.generateImageToVideo('user-1', {
      prompt: 'anima',
      resolution: Resolution.RES_720P,
      first_frame: 'AAA',
      first_frame_mime_type: 'image/png',
      last_frame: 'BBB',
    });

    expect(svc.generateImageToVideoKie).toHaveBeenCalledWith('user-1', {
      prompt: 'anima',
      model: 'veo3',
      resolution: Resolution.RES_720P,
      aspect_ratio: undefined,
      first_frame: 'AAA',
      first_frame_mime_type: 'image/png',
      last_frame: 'BBB',
      last_frame_mime_type: undefined,
    });
  });

  it('video-with-references com imagens vira REFERENCE_2_VIDEO do KIE', async () => {
    const svc = makeService();
    await svc.generateVideoWithReferences('user-1', {
      prompt: 'produto',
      model: 'geraew-quality',
      resolution: Resolution.RES_1080P,
      reference_images: [
        { base64: 'R1', mime_type: 'image/webp', reference_type: 'asset' },
        { base64: 'R2', reference_type: 'style' },
      ],
    });

    expect(svc.generateReferenceToVideoKie).toHaveBeenCalledWith('user-1', {
      prompt: 'produto',
      resolution: Resolution.RES_1080P,
      aspect_ratio: undefined,
      reference_images: ['R1', 'R2'],
      reference_images_mime_types: ['image/webp', 'image/jpeg'],
    });
  });

  it('video-with-references sem imagens vira text-to-video do KIE', async () => {
    const svc = makeService();
    await svc.generateVideoWithReferences('user-1', {
      prompt: 'só texto',
      model: 'geraew-fast',
      resolution: Resolution.RES_720P,
    });
    expect(svc.generateTextToVideoKie).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ model: 'veo3_fast' }),
    );
    expect(svc.generateReferenceToVideoKie).not.toHaveBeenCalled();
  });

  it('rejeita mais de 3 referências (limite do KIE)', async () => {
    const svc = makeService();
    const ref = { base64: 'R', reference_type: 'asset' };
    await expect(
      svc.generateVideoWithReferences('user-1', {
        prompt: 'x',
        resolution: Resolution.RES_720P,
        reference_images: [ref, ref, ref, ref],
      }),
    ).rejects.toThrow('no máximo 3');
  });

  it('modo ilimitado em vídeo devolve UNLIMITED_DISABLED sem gerar nada', async () => {
    const svc = makeService();
    await expect(
      svc.generateTextToVideo('user-1', {
        prompt: 'x',
        model: 'geraew-fast',
        resolution: Resolution.RES_720P,
        unlimited: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(svc.generateTextToVideoKie).not.toHaveBeenCalled();
  });
});

describe('Gerações grátis de vídeo valem no Veo 3.1 Fast (KIE)', () => {
  function serviceWithFree(hasFree: boolean) {
    return makeService({
      creditsService: {
        hasFreeGeneration: jest.fn().mockResolvedValue(hasFree),
      },
    });
  }

  it('VEO_FAST com saldo grátis → free_generation', async () => {
    const svc = serviceWithFree(true);
    await expect(svc.checkVeoAccess('u', 'VEO_FAST')).resolves.toBe(
      'free_generation',
    );
    expect(svc.creditsService.hasFreeGeneration).toHaveBeenCalledWith(
      'u',
      FreeGenerationType.GERAEW_FAST,
    );
  });

  it('VEO_FAST sem saldo grátis → paid', async () => {
    const svc = serviceWithFree(false);
    await expect(svc.checkVeoAccess('u', 'VEO_FAST')).resolves.toBe('paid');
  });

  it.each(['VEO_MAX', 'GERAEW_FAST', null])(
    '%s nunca usa geração grátis',
    async (variant) => {
      const svc = serviceWithFree(true);
      await expect(svc.checkVeoAccess('u', variant)).resolves.toBe('paid');
      expect(svc.creditsService.hasFreeGeneration).not.toHaveBeenCalled();
    },
  );
});

describe('Preço do Veo KIE decidido no servidor', () => {
  function serviceForKie() {
    const calculateGenerationCost = jest.fn().mockResolvedValue(1800);
    const svc: any = Object.create(GenerationsService.prototype);
    svc.modelsService = { assertActiveBySlug: jest.fn() };
    svc.creditsService = {
      hasFreeGeneration: jest.fn().mockResolvedValue(false),
    };
    svc.plansService = { calculateGenerationCost };
    svc.checkConcurrentLimit = jest.fn();
    svc.ensureSufficientBalance = jest.fn();
    svc.debitCredits = jest.fn();
    svc.uploadBase64ImagePublic = jest
      .fn()
      .mockResolvedValue('https://cdn/x.jpg');
    svc.prisma = {
      generation: { create: jest.fn().mockResolvedValue({ id: 'gen-1' }) },
      generationInputImage: { createMany: jest.fn() },
    };
    svc.generationQueue = { add: jest.fn() };
    return { svc, calculateGenerationCost };
  }

  it('ignora model_variant do cliente e sempre cobra com áudio', async () => {
    const { svc, calculateGenerationCost } = serviceForKie();
    await svc.generateTextToVideoKie('u', {
      prompt: 'x',
      model: 'veo3',
      resolution: Resolution.RES_1080P,
      model_variant: 'VEO_FAST', // tentativa de pagar o preço do Fast
      generate_audio: false,
    });
    expect(calculateGenerationCost).toHaveBeenCalledWith(
      'TEXT_TO_VIDEO',
      Resolution.RES_1080P,
      undefined,
      true,
      1,
      'VEO_MAX',
    );
  });

  it('reference-to-video gera em veo3_fast e cobra VEO_FAST mesmo se o cliente pedir VEO_MAX', async () => {
    const { svc, calculateGenerationCost } = serviceForKie();
    await svc.generateReferenceToVideoKie('u', {
      prompt: 'x',
      resolution: Resolution.RES_720P,
      reference_images: ['AAA'],
      model_variant: 'VEO_MAX',
    });
    expect(calculateGenerationCost).toHaveBeenCalledWith(
      'IMAGE_TO_VIDEO',
      Resolution.RES_720P,
      undefined,
      true,
      1,
      'VEO_FAST',
    );
    expect(svc.generationQueue.add).toHaveBeenCalledWith(
      GenerationJobName.REFERENCE_TO_VIDEO_KIE,
      expect.objectContaining({ model: 'veo3_fast', generateAudio: true }),
    );
  });
});

describe('VeoProvider (KIE) usa o modelo pedido', () => {
  function makeProvider() {
    const config = {
      get: jest.fn((_k: string, d?: string) => d),
    } as unknown as ConfigService;
    const provider = new VeoProvider(config, {} as any);
    const submit = jest
      .spyOn(provider as any, 'submitAndWait')
      .mockResolvedValue({ outputUrls: ['u'], modelUsed: 'm' });
    return { provider, submit };
  }

  it.each([
    ['veo3', 'veo3'],
    ['veo3_fast', 'veo3_fast'],
  ])('text-to-video model=%s envia %s ao KIE', async (model, expected) => {
    const { provider, submit } = makeProvider();
    await provider.generateTextToVideo({
      id: 'g',
      prompt: 'p',
      model,
      resolution: 'RES_720P',
      generateAudio: true,
    });
    expect(submit.mock.calls[0][0]).toMatchObject({ model: expected });
  });

  it('image-to-video com veo3 não cai mais em veo3_fast', async () => {
    const { provider, submit } = makeProvider();
    await provider.generateImageToVideo({
      id: 'g',
      prompt: 'p',
      model: 'veo3',
      resolution: 'RES_1080P',
      generateAudio: true,
      imageUrls: ['https://cdn/a.jpg'],
    });
    expect(submit.mock.calls[0][0]).toMatchObject({ model: 'veo3' });
  });
});

describe('GenerationProcessor sem Vertex', () => {
  function makeProcessor() {
    const proc: any = Object.create(GenerationProcessor.prototype);
    proc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    proc.prisma = {
      generationInputImage: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { url: 'https://cdn/in1.png' },
            { url: null },
            { url: 'https://cdn/in2.png' },
          ]),
      },
    };
    proc.nanoBananaProvider = {
      generateImage: jest
        .fn()
        .mockResolvedValue({ outputUrls: ['o'], modelUsed: 'nano-banana-2' }),
    };
    proc.markProcessingStarted = jest.fn();
    proc.completeGeneration = jest.fn();
    return proc;
  }

  it.each([
    GenerationJobName.TEXT_TO_VIDEO,
    GenerationJobName.IMAGE_TO_VIDEO,
    GenerationJobName.REFERENCE_VIDEO,
  ])(
    'job legado %s falha (o onFailed estorna os créditos)',
    async (jobName) => {
      const proc = makeProcessor();
      await expect(
        proc.dispatch(jobName, { generationId: 'g' }),
      ).rejects.toThrow('Vertex foi descontinuado');
    },
  );

  it('imagem Gemini vai direto pro Nano Banana do KIE com as URLs de entrada', async () => {
    const proc = makeProcessor();
    await proc.dispatch(GenerationJobName.IMAGE_WITH_FALLBACK, {
      generationId: 'g',
      userId: 'u',
      creditsConsumed: 90,
      prompt: 'retrato',
      model: 'gemini-3.1-flash-image-preview',
      resolution: 'RES_1K',
      aspectRatio: '1:1',
      mimeType: 'image/png',
      hasInputImages: true,
    });

    expect(proc.nanoBananaProvider.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'g',
        model: 'nano-banana-2',
        prompt: 'retrato',
        outputFormat: 'png',
        imageUrls: ['https://cdn/in1.png', 'https://cdn/in2.png'],
      }),
    );
    expect(proc.completeGeneration).toHaveBeenCalledWith(
      'g',
      { outputUrls: ['o'], modelUsed: 'nano-banana-2' },
      expect.any(Number),
      'nano-banana-2',
    );
  });

  it('imagem Gemini sem entradas não consulta imagens de input', async () => {
    const proc = makeProcessor();
    await proc.dispatch(GenerationJobName.IMAGE, {
      generationId: 'g',
      userId: 'u',
      creditsConsumed: 90,
      prompt: 'paisagem',
      model: 'gemini-3-pro-image-preview',
      resolution: 'RES_2K',
      hasInputImages: false,
    });
    expect(proc.prisma.generationInputImage.findMany).not.toHaveBeenCalled();
    expect(proc.nanoBananaProvider.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'nano-banana-pro',
        imageUrls: undefined,
      }),
    );
  });
});
