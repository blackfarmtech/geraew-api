import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from '../admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ModelsService } from '../../models/models.service';
import { UploadsService } from '../../uploads/uploads.service';

/**
 * getAudienceInsights dispara 7 $queryRaw em Promise.all — o mock devolve as
 * respostas na mesma ordem em que o service as declara.
 */
function prismaWith(results: unknown[]) {
  let call = 0;
  return {
    $queryRaw: jest.fn(() => Promise.resolve(results[call++] ?? [])),
  };
}

const ROWS = {
  totals: [{ active_users: 120, answered: 90, with_phone: 88, with_instagram: 51 }],
  profileTypes: [
    { id: 'SELLER', users: 60, paid_users: 21 },
    { id: 'OTHER', users: 5, paid_users: 0 },
  ],
  niches: [{ id: 'BEAUTY', users: 40, paid_users: 18 }],
  channels: [{ id: 'TIKTOK_SHOP', users: 55 }],
  otherProfileTypes: [{ text: 'Dropshipping internacional', users: 3 }],
  otherNiches: [{ text: 'Papelaria criativa', users: 1 }],
  daily: [{ date: new Date('2026-07-24T00:00:00Z'), count: 12 }],
};

const ORDER = [
  ROWS.totals,
  ROWS.profileTypes,
  ROWS.niches,
  ROWS.channels,
  ROWS.otherProfileTypes,
  ROWS.otherNiches,
  ROWS.daily,
];

async function build(results: unknown[]) {
  const prisma = prismaWith(results);
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AdminService,
      { provide: PrismaService, useValue: prisma },
      // dependências que este método não usa
      { provide: ModelsService, useValue: {} },
      { provide: UploadsService, useValue: {} },
    ],
  }).compile();
  return { service: module.get(AdminService), prisma };
}

describe('AdminService.getAudienceInsights', () => {
  it('maps every aggregation into the dashboard contract', async () => {
    const { service } = await build(ORDER);

    const result = await service.getAudienceInsights(30);

    expect(result.periodDays).toBe(30);
    expect(result.totals).toEqual({
      activeUsers: 120,
      answered: 90,
      pending: 30,
      withPhone: 88,
      withInstagram: 51,
    });
    expect(result.profileTypes[0]).toEqual({ id: 'SELLER', users: 60, paidUsers: 21 });
    expect(result.niches[0]).toEqual({ id: 'BEAUTY', users: 40, paidUsers: 18 });
    expect(result.channels).toEqual([{ id: 'TIKTOK_SHOP', users: 55 }]);
    expect(result.otherProfileTypes[0].text).toBe('Dropshipping internacional');
    expect(result.otherNiches[0].text).toBe('Papelaria criativa');
    // o front espera YYYY-MM-DD, não Date
    expect(result.daily).toEqual([{ date: '2026-07-24', count: 12 }]);
  });

  it('reports periodDays = null when no cohort is given', async () => {
    const { service } = await build(ORDER);

    const result = await service.getAudienceInsights();

    expect(result.periodDays).toBeNull();
  });

  it('survives an empty database without dividing by anything', async () => {
    const { service } = await build([[], [], [], [], [], [], []]);

    const result = await service.getAudienceInsights();

    expect(result.totals).toEqual({
      activeUsers: 0,
      answered: 0,
      pending: 0,
      withPhone: 0,
      withInstagram: 0,
    });
    expect(result.profileTypes).toEqual([]);
    expect(result.daily).toEqual([]);
  });
});
