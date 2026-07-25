import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from '../users.service';
import { PrismaService } from '../../prisma/prisma.service';

// ── Fixtures ─────────────────────────────────────────────────────────

const now = new Date('2026-01-01');

const mockPlan = {
  slug: 'free',
  name: 'Free',
  priceCents: 0,
  maxConcurrentGenerations: 1,
  hasWatermark: true,
  hasApiAccess: false,
};

const mockSubscription = {
  status: 'ACTIVE',
  currentPeriodStart: now,
  currentPeriodEnd: now,
  cancelAtPeriodEnd: false,
  plan: mockPlan,
};

const mockCreditBalance = {
  planCreditsRemaining: 300,
  bonusCreditsRemaining: 0,
  planCreditsUsed: 0,
  periodStart: now,
  periodEnd: now,
};

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  avatarUrl: null,
  role: 'USER',
  emailVerified: false,
  isActive: true,
  createdAt: now,
  updatedAt: now,
  oauthProvider: null,
  oauthProviderId: null,
  passwordHash: 'hashed',
  hasCompletedOnboarding: false,
  country: null,
  locale: 'pt-BR',
  currency: 'BRL',
  timezone: null,
  profileCompletedAt: null,
  profileType: null,
  profileTypeOther: null,
  niche: null,
  nicheOther: null,
  salesChannels: [],
  phone: null,
  instagramHandle: null,
  taxId: null,
  subscriptions: [mockSubscription],
  creditBalance: mockCreditBalance,
  feedback: null,
};

/** Campos do perfil que não dependem de plano/créditos/assinatura. */
const expectedBaseProfile = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  avatarUrl: null,
  role: 'USER',
  emailVerified: false,
  createdAt: now,
  hasCompletedOnboarding: false,
  country: null,
  locale: 'pt-BR',
  currency: 'BRL',
  timezone: null,
  profileCompleted: false,
  profileType: null,
  profileTypeOther: null,
  niche: null,
  nicheOther: null,
  salesChannels: [],
  phone: null,
  instagramHandle: null,
  feedbackSubmitted: false,
  hasTaxIdOnFile: false,
  taxIdMasked: null,
};

// ── Mocks ────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    updateMany: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(mockPrisma)),
};

// ── Test Suite ───────────────────────────────────────────────────────

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  // ────────────────────── getProfile ──────────────────────

  describe('getProfile', () => {
    it('should return full profile with plan, credits, and subscription', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getProfile('user-1');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1', isActive: true },
        include: {
          subscriptions: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { plan: true },
          },
          creditBalance: true,
          feedback: { select: { id: true } },
        },
      });

      expect(result).toEqual({
        ...expectedBaseProfile,
        plan: {
          slug: 'free',
          name: 'Free',
          priceCents: 0,
          maxConcurrentGenerations: 1,
          hasWatermark: true,
          hasApiAccess: false,
        },
        credits: {
          planCreditsRemaining: 300,
          bonusCreditsRemaining: 0,
          planCreditsUsed: 0,
          periodStart: now,
          periodEnd: now,
        },
        subscription: {
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: now,
          cancelAtPeriodEnd: false,
        },
      });
    });

    it('should return profile with null plan/credits/subscription when user has none', async () => {
      const userWithoutExtras = {
        ...mockUser,
        subscriptions: [],
        creditBalance: null,
      };
      mockPrisma.user.findUnique.mockResolvedValue(userWithoutExtras);

      const result = await service.getProfile('user-1');

      expect(result.plan).toBeNull();
      expect(result.credits).toBeNull();
      expect(result.subscription).toBeNull();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getProfile('nonexistent')).rejects.toThrow(
        'Usuário não encontrado',
      );
    });

    it('should throw NotFoundException if user isActive=false', async () => {
      // findUnique with isActive: true in where clause returns null for inactive users
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('inactive-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ────────────────────── updateProfile ──────────────────────

  describe('updateProfile', () => {
    it('should update name only', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({
        ...mockUser,
        name: 'New Name',
      });

      // getProfile is called after update, so mock findUnique for both calls
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(mockUser) // first call: existence check
        .mockResolvedValueOnce({ ...mockUser, name: 'New Name' }); // second call: getProfile

      const result = await service.updateProfile('user-1', {
        name: 'New Name',
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: 'New Name' },
      });
      expect(result.name).toBe('New Name');
    });

    it('should update avatarUrl only', async () => {
      const avatarUrl = 'https://example.com/avatar.jpg';
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({ ...mockUser, avatarUrl });
      mockPrisma.user.update.mockResolvedValue({
        ...mockUser,
        avatarUrl,
      });

      const result = await service.updateProfile('user-1', { avatarUrl });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { avatarUrl },
      });
      expect(result.avatarUrl).toBe(avatarUrl);
    });

    it('should update both name and avatarUrl', async () => {
      const dto = {
        name: 'Updated Name',
        avatarUrl: 'https://example.com/new-avatar.jpg',
      };
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({ ...mockUser, ...dto });
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, ...dto });

      const result = await service.updateProfile('user-1', dto);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: 'Updated Name', avatarUrl: dto.avatarUrl },
      });
      expect(result.name).toBe('Updated Name');
      expect(result.avatarUrl).toBe(dto.avatarUrl);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile('nonexistent', { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return full profile after update (calls getProfile)', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(mockUser) // existence check
        .mockResolvedValueOnce(mockUser); // getProfile call
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await service.updateProfile('user-1', {
        name: 'Test User',
      });

      // The result should be a full profile (same shape as getProfile)
      expect(result).toHaveProperty('plan');
      expect(result).toHaveProperty('credits');
      expect(result).toHaveProperty('subscription');

      // findUnique should be called twice: once for existence check, once for getProfile
      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  // ─────────────── completeOnboardingProfile ───────────────

  describe('completeOnboardingProfile', () => {
    const dto = {
      profileType: 'SELLER',
      niche: 'BEAUTY',
      salesChannels: ['TIKTOK_SHOP', 'INSTAGRAM'],
      phone: '+5511912345678',
      instagramHandle: 'geraew.ai',
    };

    it('should persist the answers and stamp profileCompletedAt', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({ ...mockUser, ...dto, profileCompletedAt: now });

      const result = await service.completeOnboardingProfile('user-1', dto);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          profileType: 'SELLER',
          niche: 'BEAUTY',
          profileTypeOther: null,
          nicheOther: null,
          salesChannels: ['TIKTOK_SHOP', 'INSTAGRAM'],
          phone: '+5511912345678',
          instagramHandle: 'geraew.ai',
          profileCompletedAt: expect.any(Date),
        },
      });
      expect(result.profileCompleted).toBe(true);
      expect(result.niche).toBe('BEAUTY');
    });

    it('should persist the free text when the answer is OTHER', async () => {
      const otherDto = {
        profileType: 'OTHER',
        profileTypeOther: 'Dropshipping internacional',
        niche: 'OTHER',
        nicheOther: 'Papelaria criativa',
        phone: '+5511912345678',
      };
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({ ...mockUser, ...otherDto, profileCompletedAt: now });

      await service.completeOnboardingProfile('user-1', otherDto);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            profileTypeOther: 'Dropshipping internacional',
            nicheOther: 'Papelaria criativa',
          }),
        }),
      );
    });

    it('should drop a stale free text when the answer is no longer OTHER', async () => {
      const answered = {
        ...mockUser,
        profileType: 'OTHER',
        profileTypeOther: 'Dropshipping internacional',
        profileCompletedAt: now,
      };
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(answered)
        .mockResolvedValueOnce(answered);

      // reenviando o formulário com uma opção da lista + texto antigo pendurado
      await service.completeOnboardingProfile('user-1', {
        ...dto,
        profileTypeOther: 'Dropshipping internacional',
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ profileTypeOther: null }),
        }),
      );
    });

    it('should keep the original profileCompletedAt when answering again', async () => {
      const answered = { ...mockUser, profileCompletedAt: now };
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(answered)
        .mockResolvedValueOnce({ ...answered, ...dto });

      await service.completeOnboardingProfile('user-1', dto);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ profileCompletedAt: now }),
        }),
      );
    });

    it('should default salesChannels to an empty array when omitted', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockUser);

      await service.completeOnboardingProfile('user-1', {
        profileType: 'PHOTOGRAPHER',
        niche: 'FASHION',
        phone: '+5511912345678',
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            salesChannels: [],
            instagramHandle: null,
          }),
        }),
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.completeOnboardingProfile('nonexistent', dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ────────────────────── deleteAccount ──────────────────────

  describe('deleteAccount', () => {
    it('should soft delete (set isActive=false) and revoke all refresh tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.deleteAccount('user-1');

      expect(result).toEqual({ message: 'Conta desativada com sucesso' });

      // Verifies soft delete
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isActive: false },
      });

      // Verifies token revocation
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { revoked: true },
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteAccount('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.deleteAccount('nonexistent')).rejects.toThrow(
        'Usuário não encontrado',
      );
    });

    it('should use $transaction for atomicity', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await service.deleteAccount('user-1');

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });
  });
});
