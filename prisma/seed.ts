import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Stripe Price IDs — lidos do .env (dev usa test IDs, prod usa live IDs)
const STRIPE = {
  // Plans (new pricing)
  planStarter: process.env.STRIPE_PRICE_PLAN_STARTER ?? '',
  planCreator: process.env.STRIPE_PRICE_PLAN_CREATOR ?? '',
  planPro: process.env.STRIPE_PRICE_PLAN_PRO ?? '',
  planStudio: process.env.STRIPE_PRICE_PLAN_STUDIO ?? '',
  // Plans (legacy — inactive)
  priceStarter: process.env.STRIPE_PRICE_STARTER ?? '',
  pricePro: process.env.STRIPE_PRICE_PRO ?? '',
  priceBusiness: process.env.STRIPE_PRICE_BUSINESS ?? '',
  // Legacy credit packages
  priceCredits500: process.env.STRIPE_PRICE_CREDITS_500 ?? '',
  priceCredits1000: process.env.STRIPE_PRICE_CREDITS_1000 ?? '',
  priceCredits5000: process.env.STRIPE_PRICE_CREDITS_5000 ?? '',
  // New credit packages
  pricePackStarter: process.env.STRIPE_PRICE_PACK_STARTER ?? '',
  pricePackCreator: process.env.STRIPE_PRICE_PACK_CREATOR ?? '',
  pricePackPro: process.env.STRIPE_PRICE_PACK_PRO ?? '',
  pricePackStudio: process.env.STRIPE_PRICE_PACK_STUDIO ?? '',
};

async function main() {
  console.log('🌱 Starting database seed...');

  // ============================================
  // Seed Plans
  // ============================================
  console.log('📋 Creating plans...');

  const plans = await Promise.all([
    // ── New plans (nova precificação) ──
    prisma.plan.upsert({
      where: { slug: 'free' },
      update: { creditsPerMonth: 30, isActive: true },
      create: {
        slug: 'free',
        name: 'Free',
        priceCents: 0,
        creditsPerMonth: 30,
        maxConcurrentGenerations: 1,
        hasWatermark: true,
        galleryRetentionDays: 30,
        hasApiAccess: false,
        sortOrder: 0,
      },
    }),
    prisma.plan.upsert({
      where: { slug: 'starter' },
      update: {
        name: 'Starter',
        priceCents: 3900,
        creditsPerMonth: 600,
        maxConcurrentGenerations: 2,
        hasWatermark: false,
        galleryRetentionDays: null,
        hasApiAccess: false,
        isActive: true,
        sortOrder: 1,
        stripePriceId: STRIPE.planStarter,
      },
      create: {
        slug: 'starter',
        name: 'Starter',
        priceCents: 3900,
        creditsPerMonth: 600,
        maxConcurrentGenerations: 2,
        hasWatermark: false,
        galleryRetentionDays: null,
        hasApiAccess: false,
        sortOrder: 1,
        stripePriceId: STRIPE.planStarter,
      },
    }),
    prisma.plan.upsert({
      where: { slug: 'creator' },
      update: {
        name: 'Creator',
        priceCents: 8900,
        creditsPerMonth: 1600,
        maxConcurrentGenerations: 3,
        hasWatermark: false,
        galleryRetentionDays: null,
        hasApiAccess: false,
        isActive: true,
        sortOrder: 2,
        stripePriceId: STRIPE.planCreator,
      },
      create: {
        slug: 'creator',
        name: 'Creator',
        priceCents: 8900,
        creditsPerMonth: 1600,
        maxConcurrentGenerations: 3,
        hasWatermark: false,
        galleryRetentionDays: null,
        hasApiAccess: false,
        sortOrder: 2,
        stripePriceId: STRIPE.planCreator,
      },
    }),
    prisma.plan.upsert({
      where: { slug: 'pro' },
      update: {
        name: 'Pro',
        priceCents: 17900,
        creditsPerMonth: 3500,
        maxConcurrentGenerations: 5,
        hasWatermark: false,
        galleryRetentionDays: null,
        hasApiAccess: false,
        isActive: true,
        sortOrder: 3,
        stripePriceId: STRIPE.planPro,
      },
      create: {
        slug: 'pro',
        name: 'Pro',
        priceCents: 17900,
        creditsPerMonth: 3500,
        maxConcurrentGenerations: 5,
        hasWatermark: false,
        galleryRetentionDays: null,
        hasApiAccess: false,
        sortOrder: 3,
        stripePriceId: STRIPE.planPro,
      },
    }),
    prisma.plan.upsert({
      where: { slug: 'studio' },
      update: {
        name: 'Studio',
        priceCents: 36900,
        creditsPerMonth: 8000,
        maxConcurrentGenerations: 10,
        hasWatermark: false,
        galleryRetentionDays: null,
        hasApiAccess: true,
        isActive: true,
        sortOrder: 4,
        stripePriceId: STRIPE.planStudio,
      },
      create: {
        slug: 'studio',
        name: 'Studio',
        priceCents: 36900,
        creditsPerMonth: 8000,
        maxConcurrentGenerations: 10,
        hasWatermark: false,
        galleryRetentionDays: null,
        hasApiAccess: true,
        sortOrder: 4,
        stripePriceId: STRIPE.planStudio,
      },
    }),
    // ── Legacy plans (desativados) ──
    prisma.plan.upsert({
      where: { slug: 'business' },
      update: { isActive: false, sortOrder: 99 },
      create: {
        slug: 'business',
        name: 'Business',
        priceCents: 24990,
        creditsPerMonth: 10000,
        maxConcurrentGenerations: 10,
        hasWatermark: false,
        galleryRetentionDays: null,
        hasApiAccess: true,
        sortOrder: 99,
        isActive: false,
        stripePriceId: STRIPE.priceBusiness,
      },
    }),
  ]);

  console.log(`✅ Created ${plans.length} plans`);

  // ============================================
  // Seed Credit Costs
  // ============================================
  console.log('💰 Creating credit costs...');

  const creditCosts = [
    // Images - Nano Banana 2 (NB2)
    { generationType: 'TEXT_TO_IMAGE', resolution: 'RES_1K', hasAudio: false, modelVariant: 'NB2', creditsPerUnit: 6, isPerSecond: false },
    { generationType: 'TEXT_TO_IMAGE', resolution: 'RES_2K', hasAudio: false, modelVariant: 'NB2', creditsPerUnit: 9, isPerSecond: false },
    { generationType: 'TEXT_TO_IMAGE', resolution: 'RES_4K', hasAudio: false, modelVariant: 'NB2', creditsPerUnit: 13, isPerSecond: false },
    { generationType: 'IMAGE_TO_IMAGE', resolution: 'RES_1K', hasAudio: false, modelVariant: 'NB2', creditsPerUnit: 6, isPerSecond: false },
    { generationType: 'IMAGE_TO_IMAGE', resolution: 'RES_2K', hasAudio: false, modelVariant: 'NB2', creditsPerUnit: 9, isPerSecond: false },
    { generationType: 'IMAGE_TO_IMAGE', resolution: 'RES_4K', hasAudio: false, modelVariant: 'NB2', creditsPerUnit: 13, isPerSecond: false },

    // Images - Nano Banana Pro (NBP)
    { generationType: 'TEXT_TO_IMAGE', resolution: 'RES_1K', hasAudio: false, modelVariant: 'NBP', creditsPerUnit: 13, isPerSecond: false },
    { generationType: 'TEXT_TO_IMAGE', resolution: 'RES_2K', hasAudio: false, modelVariant: 'NBP', creditsPerUnit: 13, isPerSecond: false },
    { generationType: 'TEXT_TO_IMAGE', resolution: 'RES_4K', hasAudio: false, modelVariant: 'NBP', creditsPerUnit: 17, isPerSecond: false },
    { generationType: 'IMAGE_TO_IMAGE', resolution: 'RES_1K', hasAudio: false, modelVariant: 'NBP', creditsPerUnit: 13, isPerSecond: false },
    { generationType: 'IMAGE_TO_IMAGE', resolution: 'RES_2K', hasAudio: false, modelVariant: 'NBP', creditsPerUnit: 13, isPerSecond: false },
    { generationType: 'IMAGE_TO_IMAGE', resolution: 'RES_4K', hasAudio: false, modelVariant: 'NBP', creditsPerUnit: 17, isPerSecond: false },

    // Motion Control (no model variant)
    { generationType: 'MOTION_CONTROL', resolution: 'RES_720P', hasAudio: false, modelVariant: null, creditsPerUnit: 5, isPerSecond: false },
    { generationType: 'MOTION_CONTROL', resolution: 'RES_1080P', hasAudio: false, modelVariant: null, creditsPerUnit: 8, isPerSecond: false },

    // Veo 3.1 Fast (VEO_FAST) - Text to Video
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_720P', hasAudio: false, modelVariant: 'VEO_FAST', creditsPerUnit: 10, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_1080P', hasAudio: false, modelVariant: 'VEO_FAST', creditsPerUnit: 10, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_720P', hasAudio: true, modelVariant: 'VEO_FAST', creditsPerUnit: 15, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_1080P', hasAudio: true, modelVariant: 'VEO_FAST', creditsPerUnit: 15, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_4K', hasAudio: false, modelVariant: 'VEO_FAST', creditsPerUnit: 25, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_4K', hasAudio: true, modelVariant: 'VEO_FAST', creditsPerUnit: 30, isPerSecond: false },

    // Veo 3.1 Fast (VEO_FAST) - Image to Video
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_720P', hasAudio: false, modelVariant: 'VEO_FAST', creditsPerUnit: 10, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_1080P', hasAudio: false, modelVariant: 'VEO_FAST', creditsPerUnit: 10, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_720P', hasAudio: true, modelVariant: 'VEO_FAST', creditsPerUnit: 15, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_1080P', hasAudio: true, modelVariant: 'VEO_FAST', creditsPerUnit: 15, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_4K', hasAudio: false, modelVariant: 'VEO_FAST', creditsPerUnit: 25, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_4K', hasAudio: true, modelVariant: 'VEO_FAST', creditsPerUnit: 30, isPerSecond: false },

    // Veo 3.1 Fast (VEO_FAST) - Reference Video (mirrors Image to Video)
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_720P', hasAudio: false, modelVariant: 'VEO_FAST', creditsPerUnit: 10, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_1080P', hasAudio: false, modelVariant: 'VEO_FAST', creditsPerUnit: 10, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_720P', hasAudio: true, modelVariant: 'VEO_FAST', creditsPerUnit: 15, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_1080P', hasAudio: true, modelVariant: 'VEO_FAST', creditsPerUnit: 15, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_4K', hasAudio: false, modelVariant: 'VEO_FAST', creditsPerUnit: 25, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_4K', hasAudio: true, modelVariant: 'VEO_FAST', creditsPerUnit: 30, isPerSecond: false },

    // Veo 3.1 Max (VEO_MAX) - Text to Video
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_720P', hasAudio: false, modelVariant: 'VEO_MAX', creditsPerUnit: 20, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_1080P', hasAudio: false, modelVariant: 'VEO_MAX', creditsPerUnit: 20, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_720P', hasAudio: true, modelVariant: 'VEO_MAX', creditsPerUnit: 35, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_1080P', hasAudio: true, modelVariant: 'VEO_MAX', creditsPerUnit: 35, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_4K', hasAudio: false, modelVariant: 'VEO_MAX', creditsPerUnit: 35, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_4K', hasAudio: true, modelVariant: 'VEO_MAX', creditsPerUnit: 50, isPerSecond: false },

    // Veo 3.1 Max (VEO_MAX) - Image to Video
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_720P', hasAudio: false, modelVariant: 'VEO_MAX', creditsPerUnit: 20, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_1080P', hasAudio: false, modelVariant: 'VEO_MAX', creditsPerUnit: 20, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_720P', hasAudio: true, modelVariant: 'VEO_MAX', creditsPerUnit: 35, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_1080P', hasAudio: true, modelVariant: 'VEO_MAX', creditsPerUnit: 35, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_4K', hasAudio: false, modelVariant: 'VEO_MAX', creditsPerUnit: 35, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_4K', hasAudio: true, modelVariant: 'VEO_MAX', creditsPerUnit: 50, isPerSecond: false },

    // Veo 3.1 Max (VEO_MAX) - Reference Video (mirrors Image to Video)
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_720P', hasAudio: false, modelVariant: 'VEO_MAX', creditsPerUnit: 20, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_1080P', hasAudio: false, modelVariant: 'VEO_MAX', creditsPerUnit: 20, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_720P', hasAudio: true, modelVariant: 'VEO_MAX', creditsPerUnit: 35, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_1080P', hasAudio: true, modelVariant: 'VEO_MAX', creditsPerUnit: 35, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_4K', hasAudio: false, modelVariant: 'VEO_MAX', creditsPerUnit: 35, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_4K', hasAudio: true, modelVariant: 'VEO_MAX', creditsPerUnit: 50, isPerSecond: false },
  ];

  // Deactivate all existing credit costs, then upsert new ones
  await prisma.creditCost.updateMany({ data: { isActive: false } });

  for (const cost of creditCosts) {
    // For nullable modelVariant in compound unique, we need to find-or-create manually
    const existing = await prisma.creditCost.findFirst({
      where: {
        generationType: cost.generationType as any,
        resolution: cost.resolution as any,
        hasAudio: cost.hasAudio,
        modelVariant: cost.modelVariant,
      },
    });

    if (existing) {
      await prisma.creditCost.update({
        where: { id: existing.id },
        data: {
          creditsPerUnit: cost.creditsPerUnit,
          isPerSecond: cost.isPerSecond,
          isActive: true,
        },
      });
    } else {
      await prisma.creditCost.create({
        data: cost as any,
      });
    }
  }

  console.log(`✅ Created ${creditCosts.length} credit costs`);

  // ============================================
  // Seed Credit Packages
  // ============================================
  console.log('📦 Creating credit packages...');

  const packages = await Promise.all([
    // New credit packs
    prisma.creditPackage.upsert({
      where: { name: 'Starter' },
      update: { credits: 600, priceCents: 3900, sortOrder: 0, stripePriceId: STRIPE.pricePackStarter },
      create: {
        name: 'Starter',
        credits: 600,
        priceCents: 3900,
        sortOrder: 0,
        stripePriceId: STRIPE.pricePackStarter,
      },
    }),
    prisma.creditPackage.upsert({
      where: { name: 'Creator' },
      update: { credits: 1600, priceCents: 8900, sortOrder: 1, stripePriceId: STRIPE.pricePackCreator },
      create: {
        name: 'Creator',
        credits: 1600,
        priceCents: 8900,
        sortOrder: 1,
        stripePriceId: STRIPE.pricePackCreator,
      },
    }),
    prisma.creditPackage.upsert({
      where: { name: 'Pro' },
      update: { credits: 3500, priceCents: 17900, sortOrder: 2, stripePriceId: STRIPE.pricePackPro },
      create: {
        name: 'Pro',
        credits: 3500,
        priceCents: 17900,
        sortOrder: 2,
        stripePriceId: STRIPE.pricePackPro,
      },
    }),
    prisma.creditPackage.upsert({
      where: { name: 'Studio' },
      update: { credits: 8000, priceCents: 36900, sortOrder: 3, stripePriceId: STRIPE.pricePackStudio },
      create: {
        name: 'Studio',
        credits: 8000,
        priceCents: 36900,
        sortOrder: 3,
        stripePriceId: STRIPE.pricePackStudio,
      },
    }),
    // Legacy packages (kept for backward compatibility, marked inactive)
    prisma.creditPackage.upsert({
      where: { name: 'Pacote 500' },
      update: { isActive: false },
      create: {
        name: 'Pacote 500',
        credits: 500,
        priceCents: 1790,
        sortOrder: 10,
        isActive: false,
        stripePriceId: STRIPE.priceCredits500,
      },
    }),
    prisma.creditPackage.upsert({
      where: { name: 'Pacote 1.000' },
      update: { isActive: false },
      create: {
        name: 'Pacote 1.000',
        credits: 1000,
        priceCents: 2990,
        sortOrder: 11,
        isActive: false,
        stripePriceId: STRIPE.priceCredits1000,
      },
    }),
    prisma.creditPackage.upsert({
      where: { name: 'Pacote 5.000' },
      update: { isActive: false },
      create: {
        name: 'Pacote 5.000',
        credits: 5000,
        priceCents: 12990,
        sortOrder: 12,
        isActive: false,
        stripePriceId: STRIPE.priceCredits5000,
      },
    }),
  ]);

  console.log(`✅ Created ${packages.length} credit packages`);

  // ============================================
  // Seed Test Users (Development only)
  // ============================================
  if (process.env.NODE_ENV === 'development') {
    console.log('👤 Creating test users...');

    // Admin user
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@geraew.com' },
      update: {},
      create: {
        email: 'admin@geraew.com',
        name: 'Admin User',
        passwordHash: await bcrypt.hash('admin123', 10),
        role: 'ADMIN',
        emailVerified: true,
      },
    });

    // Regular test users with different plans
    const testUsers = [
      { email: 'business@test.com', name: 'Business User', plan: 'business' },
    ];

    for (const userData of testUsers) {
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {},
        create: {
          email: userData.email,
          name: userData.name,
          passwordHash: await bcrypt.hash('password123', 10),
          role: 'USER',
          emailVerified: true,
        },
      });

      // Create subscription for the user
      const plan = plans.find(p => p.slug === userData.plan);
      if (plan) {
        const now = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);

        await prisma.subscription.upsert({
          where: { id: (await prisma.subscription.findFirst({ where: { userId: user.id } }))?.id ?? '' },
          update: { planId: plan.id, status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: endDate },
          create: {
            userId: user.id,
            planId: plan.id,
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: endDate,
            paymentProvider: 'stripe',
          },
        });

        // Create credit balance
        await prisma.creditBalance.upsert({
          where: { userId: user.id },
          update: {
            planCreditsRemaining: plan.creditsPerMonth,
            planCreditsUsed: 0,
            periodStart: now,
            periodEnd: endDate,
          },
          create: {
            userId: user.id,
            planCreditsRemaining: plan.creditsPerMonth,
            bonusCreditsRemaining: 0,
            planCreditsUsed: 0,
            periodStart: now,
            periodEnd: endDate,
          },
        });

        // Create initial credit transaction
        await prisma.creditTransaction.create({
          data: {
            userId: user.id,
            type: 'SUBSCRIPTION_RENEWAL',
            amount: plan.creditsPerMonth,
            source: 'plan',
            description: `Initial ${plan.name} plan credits`,
          },
        });
      }
    }

    console.log(`✅ Created ${testUsers.length + 1} test users`);

    // Create some sample generations for the Pro user
    const proUser = await prisma.user.findUnique({
      where: { email: 'pro@test.com' },
    });

  }

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });