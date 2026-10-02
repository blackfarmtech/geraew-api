import { ForbiddenException } from '@nestjs/common';
import { Resolution } from '@prisma/client';
import { UnlimitedService } from '../unlimited.service';
import { GenerationsService } from '../../generations/generations.service';

/** Modo ilimitado descontinuado: só volta com UNLIMITED_ENABLED=true. */

function makeUnlimitedService(flag: string | undefined) {
  const prisma = {
    subscription: {
      findFirst: jest.fn().mockResolvedValue({
        plan: {
          id: 'plan-studio',
          slug: 'studio',
          unlimitedPriority: 1,
          unlimitedModels: [{ modelVariant: 'NB2', resolutions: ['RES_1K'] }],
        },
      }),
    },
  };
  const config = { get: jest.fn().mockReturnValue(flag) };
  const service = new UnlimitedService(prisma as any, {} as any, config as any);
  return { service, prisma };
}

describe('UnlimitedService — desligado por padrão', () => {
  it.each([undefined, '', 'false', '1', 'TRUE'])(
    'UNLIMITED_ENABLED=%p → nenhum plano tem ilimitado (nem consulta o banco)',
    async (flag) => {
      const { service, prisma } = makeUnlimitedService(flag);
      expect(service.isEnabled()).toBe(false);
      await expect(service.getPlanContext('user-1')).resolves.toBeNull();
      expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
    },
  );

  it('UNLIMITED_ENABLED=true reativa o comportamento antigo', async () => {
    const { service } = makeUnlimitedService('true');
    expect(service.isEnabled()).toBe(true);
    await expect(service.getPlanContext('user-1')).resolves.toMatchObject({
      planSlug: 'studio',
      unlimitedPriority: 1,
    });
  });

  it('checkEligibility responde plan_not_unlimited mesmo para o Studio', async () => {
    const { service } = makeUnlimitedService(undefined);
    await expect(
      service.checkEligibility('user-1', 'NB2', Resolution.RES_1K),
    ).resolves.toMatchObject({ allowed: false, reason: 'plan_not_unlimited' });
  });
});

describe('GenerationsService — pedidos com unlimited:true', () => {
  function makeGenerationsService() {
    const svc: any = Object.create(GenerationsService.prototype);
    svc.unlimitedService = {
      isEnabled: jest.fn().mockReturnValue(false),
      checkEligibility: jest.fn(),
      getPlanContext: jest.fn().mockResolvedValue(null),
    };
    return svc;
  }

  it('reserva de ilimitado é recusada com UNLIMITED_DISABLED antes de qualquer lock', async () => {
    const svc = makeGenerationsService();
    const promise = svc.reserveUnlimitedOrThrow(
      'user-1',
      'NB2',
      Resolution.RES_1K,
    );
    await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      svc.reserveUnlimitedOrThrow('user-1', 'NB2', Resolution.RES_1K),
    ).rejects.toMatchObject({ response: { code: 'UNLIMITED_DISABLED' } });
    expect(svc.unlimitedService.checkEligibility).not.toHaveBeenCalled();
  });

  it('status público responde não elegível', async () => {
    const svc = makeGenerationsService();
    await expect(svc.getUnlimitedStatus('user-1')).resolves.toMatchObject({
      eligible: false,
      models: [],
    });
  });
});
