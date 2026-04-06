import { PrismaClient, Plan, CreditPackage } from '@prisma/client';
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
  // Boost packages (avulsos)
  priceBoostP: process.env.STRIPE_PRICE_BOOST_P ?? '',
  priceBoostM: process.env.STRIPE_PRICE_BOOST_M ?? '',
  priceBoostG: process.env.STRIPE_PRICE_BOOST_G ?? '',
};

async function main() {
  console.log('🌱 Starting database seed...');

  // ============================================
  // Seed Plans
  // ============================================
  console.log('📋 Creating plans...');

  const planData = [
    // ── New plans (nova precificação) ──
    { slug: 'free', update: { creditsPerMonth: 300, isActive: true, galleryRetentionDays: 7 }, create: { slug: 'free', name: 'Free', priceCents: 0, creditsPerMonth: 300, maxConcurrentGenerations: 1, hasWatermark: true, galleryRetentionDays: 7, hasApiAccess: false, sortOrder: 0 } },
    { slug: 'starter', update: { name: 'Starter', priceCents: 3990, creditsPerMonth: 4000, maxConcurrentGenerations: 2, hasWatermark: false, galleryRetentionDays: 90, hasApiAccess: false, isActive: true, sortOrder: 1, stripePriceId: STRIPE.planStarter }, create: { slug: 'starter', name: 'Starter', priceCents: 3990, creditsPerMonth: 4000, maxConcurrentGenerations: 2, hasWatermark: false, galleryRetentionDays: 90, hasApiAccess: false, sortOrder: 1, stripePriceId: STRIPE.planStarter } },
    { slug: 'creator', update: { name: 'Creator', priceCents: 8990, creditsPerMonth: 12000, maxConcurrentGenerations: 3, hasWatermark: false, galleryRetentionDays: 180, hasApiAccess: false, isActive: true, sortOrder: 2, stripePriceId: STRIPE.planCreator }, create: { slug: 'creator', name: 'Creator', priceCents: 8990, creditsPerMonth: 12000, maxConcurrentGenerations: 3, hasWatermark: false, galleryRetentionDays: 180, hasApiAccess: false, sortOrder: 2, stripePriceId: STRIPE.planCreator } },
    { slug: 'pro', update: { name: 'Pro', priceCents: 17990, creditsPerMonth: 30000, maxConcurrentGenerations: 5, hasWatermark: false, galleryRetentionDays: 365, hasApiAccess: false, isActive: true, sortOrder: 3, stripePriceId: STRIPE.planPro }, create: { slug: 'pro', name: 'Pro', priceCents: 17990, creditsPerMonth: 30000, maxConcurrentGenerations: 5, hasWatermark: false, galleryRetentionDays: 365, hasApiAccess: false, sortOrder: 3, stripePriceId: STRIPE.planPro } },
    { slug: 'studio', update: { name: 'Studio', priceCents: 36990, creditsPerMonth: 80000, maxConcurrentGenerations: 10, hasWatermark: false, galleryRetentionDays: 365, hasApiAccess: true, isActive: true, sortOrder: 4, stripePriceId: STRIPE.planStudio }, create: { slug: 'studio', name: 'Studio', priceCents: 36990, creditsPerMonth: 80000, maxConcurrentGenerations: 10, hasWatermark: false, galleryRetentionDays: 365, hasApiAccess: true, sortOrder: 4, stripePriceId: STRIPE.planStudio } },
    // ── Legacy plans (desativados) ──
    { slug: 'business', update: { isActive: false, sortOrder: 99 }, create: { slug: 'business', name: 'Business', priceCents: 24990, creditsPerMonth: 10000, maxConcurrentGenerations: 10, hasWatermark: false, galleryRetentionDays: null as number | null, hasApiAccess: true, sortOrder: 99, isActive: false, stripePriceId: STRIPE.priceBusiness } },
  ];

  const plans: Plan[] = [];
  for (const plan of planData) {
    plans.push(
      await prisma.plan.upsert({
        where: { slug: plan.slug },
        update: plan.update,
        create: plan.create as any,
      }),
    );
  }

  console.log(`✅ Created ${plans.length} plans`);

  // ============================================
  // Seed Credit Costs
  // ============================================
  console.log('💰 Creating credit costs...');

  const creditCosts = [
    // Images - Nano Banana 2 (NB2) — v4 pricing
    { generationType: 'TEXT_TO_IMAGE', resolution: 'RES_1K', hasAudio: false, modelVariant: 'NB2', creditsPerUnit: 90, isPerSecond: false },
    { generationType: 'TEXT_TO_IMAGE', resolution: 'RES_2K', hasAudio: false, modelVariant: 'NB2', creditsPerUnit: 130, isPerSecond: false },
    { generationType: 'TEXT_TO_IMAGE', resolution: 'RES_4K', hasAudio: false, modelVariant: 'NB2', creditsPerUnit: 190, isPerSecond: false },
    { generationType: 'IMAGE_TO_IMAGE', resolution: 'RES_1K', hasAudio: false, modelVariant: 'NB2', creditsPerUnit: 90, isPerSecond: false },
    { generationType: 'IMAGE_TO_IMAGE', resolution: 'RES_2K', hasAudio: false, modelVariant: 'NB2', creditsPerUnit: 130, isPerSecond: false },
    { generationType: 'IMAGE_TO_IMAGE', resolution: 'RES_4K', hasAudio: false, modelVariant: 'NB2', creditsPerUnit: 190, isPerSecond: false },

    // Images - Nano Banana Pro (NBP) — v4 pricing
    { generationType: 'TEXT_TO_IMAGE', resolution: 'RES_1K', hasAudio: false, modelVariant: 'NBP', creditsPerUnit: 190, isPerSecond: false },
    { generationType: 'TEXT_TO_IMAGE', resolution: 'RES_2K', hasAudio: false, modelVariant: 'NBP', creditsPerUnit: 190, isPerSecond: false },
    { generationType: 'TEXT_TO_IMAGE', resolution: 'RES_4K', hasAudio: false, modelVariant: 'NBP', creditsPerUnit: 250, isPerSecond: false },
    { generationType: 'IMAGE_TO_IMAGE', resolution: 'RES_1K', hasAudio: false, modelVariant: 'NBP', creditsPerUnit: 190, isPerSecond: false },
    { generationType: 'IMAGE_TO_IMAGE', resolution: 'RES_2K', hasAudio: false, modelVariant: 'NBP', creditsPerUnit: 190, isPerSecond: false },
    { generationType: 'IMAGE_TO_IMAGE', resolution: 'RES_4K', hasAudio: false, modelVariant: 'NBP', creditsPerUnit: 250, isPerSecond: false },

    // Motion Control (no model variant) — per second pricing
    { generationType: 'MOTION_CONTROL', resolution: 'RES_720P', hasAudio: false, modelVariant: null, creditsPerUnit: 70, isPerSecond: true },
    { generationType: 'MOTION_CONTROL', resolution: 'RES_1080P', hasAudio: false, modelVariant: null, creditsPerUnit: 100, isPerSecond: true },

    // GeraEW Fast (GERAEW_FAST) — geraew-provider — Text to Video
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_720P', hasAudio: false, modelVariant: 'GERAEW_FAST', creditsPerUnit: 600, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_1080P', hasAudio: false, modelVariant: 'GERAEW_FAST', creditsPerUnit: 600, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_720P', hasAudio: true, modelVariant: 'GERAEW_FAST', creditsPerUnit: 900, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_1080P', hasAudio: true, modelVariant: 'GERAEW_FAST', creditsPerUnit: 900, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_4K', hasAudio: false, modelVariant: 'GERAEW_FAST', creditsPerUnit: 1600, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_4K', hasAudio: true, modelVariant: 'GERAEW_FAST', creditsPerUnit: 1800, isPerSecond: false },

    // GeraEW Fast (GERAEW_FAST) — geraew-provider — Image to Video
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_720P', hasAudio: false, modelVariant: 'GERAEW_FAST', creditsPerUnit: 600, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_1080P', hasAudio: false, modelVariant: 'GERAEW_FAST', creditsPerUnit: 600, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_720P', hasAudio: true, modelVariant: 'GERAEW_FAST', creditsPerUnit: 900, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_1080P', hasAudio: true, modelVariant: 'GERAEW_FAST', creditsPerUnit: 900, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_4K', hasAudio: false, modelVariant: 'GERAEW_FAST', creditsPerUnit: 1600, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_4K', hasAudio: true, modelVariant: 'GERAEW_FAST', creditsPerUnit: 1800, isPerSecond: false },

    // GeraEW Fast (GERAEW_FAST) — geraew-provider — Reference Video
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_720P', hasAudio: false, modelVariant: 'GERAEW_FAST', creditsPerUnit: 600, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_1080P', hasAudio: false, modelVariant: 'GERAEW_FAST', creditsPerUnit: 600, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_720P', hasAudio: true, modelVariant: 'GERAEW_FAST', creditsPerUnit: 900, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_1080P', hasAudio: true, modelVariant: 'GERAEW_FAST', creditsPerUnit: 900, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_4K', hasAudio: false, modelVariant: 'GERAEW_FAST', creditsPerUnit: 1600, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_4K', hasAudio: true, modelVariant: 'GERAEW_FAST', creditsPerUnit: 1800, isPerSecond: false },

    // GeraEW Quality (GERAEW_QUALITY) — geraew-provider — Text to Video
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_720P', hasAudio: false, modelVariant: 'GERAEW_QUALITY', creditsPerUnit: 1000, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_1080P', hasAudio: false, modelVariant: 'GERAEW_QUALITY', creditsPerUnit: 1000, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_720P', hasAudio: true, modelVariant: 'GERAEW_QUALITY', creditsPerUnit: 2000, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_1080P', hasAudio: true, modelVariant: 'GERAEW_QUALITY', creditsPerUnit: 2000, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_4K', hasAudio: false, modelVariant: 'GERAEW_QUALITY', creditsPerUnit: 2000, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_4K', hasAudio: true, modelVariant: 'GERAEW_QUALITY', creditsPerUnit: 2800, isPerSecond: false },

    // GeraEW Quality (GERAEW_QUALITY) — geraew-provider — Image to Video
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_720P', hasAudio: false, modelVariant: 'GERAEW_QUALITY', creditsPerUnit: 1000, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_1080P', hasAudio: false, modelVariant: 'GERAEW_QUALITY', creditsPerUnit: 1000, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_720P', hasAudio: true, modelVariant: 'GERAEW_QUALITY', creditsPerUnit: 2000, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_1080P', hasAudio: true, modelVariant: 'GERAEW_QUALITY', creditsPerUnit: 2000, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_4K', hasAudio: false, modelVariant: 'GERAEW_QUALITY', creditsPerUnit: 2000, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_4K', hasAudio: true, modelVariant: 'GERAEW_QUALITY', creditsPerUnit: 2800, isPerSecond: false },

    // GeraEW Quality (GERAEW_QUALITY) — geraew-provider — Reference Video
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_720P', hasAudio: false, modelVariant: 'GERAEW_QUALITY', creditsPerUnit: 1000, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_1080P', hasAudio: false, modelVariant: 'GERAEW_QUALITY', creditsPerUnit: 1000, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_720P', hasAudio: true, modelVariant: 'GERAEW_QUALITY', creditsPerUnit: 2000, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_1080P', hasAudio: true, modelVariant: 'GERAEW_QUALITY', creditsPerUnit: 2000, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_4K', hasAudio: false, modelVariant: 'GERAEW_QUALITY', creditsPerUnit: 2000, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_4K', hasAudio: true, modelVariant: 'GERAEW_QUALITY', creditsPerUnit: 2800, isPerSecond: false },

    // Veo 3.1 Fast (VEO_FAST) — KIE API — always hasAudio=true — more expensive than GeraEW
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_720P', hasAudio: true, modelVariant: 'VEO_FAST', creditsPerUnit: 1300, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_1080P', hasAudio: true, modelVariant: 'VEO_FAST', creditsPerUnit: 1300, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_4K', hasAudio: true, modelVariant: 'VEO_FAST', creditsPerUnit: 2600, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_720P', hasAudio: true, modelVariant: 'VEO_FAST', creditsPerUnit: 1300, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_1080P', hasAudio: true, modelVariant: 'VEO_FAST', creditsPerUnit: 1300, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_4K', hasAudio: true, modelVariant: 'VEO_FAST', creditsPerUnit: 2600, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_720P', hasAudio: true, modelVariant: 'VEO_FAST', creditsPerUnit: 1300, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_1080P', hasAudio: true, modelVariant: 'VEO_FAST', creditsPerUnit: 1300, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_4K', hasAudio: true, modelVariant: 'VEO_FAST', creditsPerUnit: 2600, isPerSecond: false },

    // Veo 3.1 Quality (VEO_MAX) — KIE API — always hasAudio=true — more expensive than GeraEW
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_720P', hasAudio: true, modelVariant: 'VEO_MAX', creditsPerUnit: 2900, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_1080P', hasAudio: true, modelVariant: 'VEO_MAX', creditsPerUnit: 2900, isPerSecond: false },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_4K', hasAudio: true, modelVariant: 'VEO_MAX', creditsPerUnit: 4100, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_720P', hasAudio: true, modelVariant: 'VEO_MAX', creditsPerUnit: 2900, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_1080P', hasAudio: true, modelVariant: 'VEO_MAX', creditsPerUnit: 2900, isPerSecond: false },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_4K', hasAudio: true, modelVariant: 'VEO_MAX', creditsPerUnit: 4100, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_720P', hasAudio: true, modelVariant: 'VEO_MAX', creditsPerUnit: 2900, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_1080P', hasAudio: true, modelVariant: 'VEO_MAX', creditsPerUnit: 2900, isPerSecond: false },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_4K', hasAudio: true, modelVariant: 'VEO_MAX', creditsPerUnit: 4100, isPerSecond: false },

    // Virtual Try-On — NB2 (mirrors IMAGE_TO_IMAGE NB2 pricing)
    { generationType: 'VIRTUAL_TRY_ON', resolution: 'RES_1K', hasAudio: false, modelVariant: 'NB2', creditsPerUnit: 90, isPerSecond: false },
    { generationType: 'VIRTUAL_TRY_ON', resolution: 'RES_2K', hasAudio: false, modelVariant: 'NB2', creditsPerUnit: 130, isPerSecond: false },
    { generationType: 'VIRTUAL_TRY_ON', resolution: 'RES_4K', hasAudio: false, modelVariant: 'NB2', creditsPerUnit: 190, isPerSecond: false },

    // Virtual Try-On — NBP (mirrors IMAGE_TO_IMAGE NBP pricing)
    { generationType: 'VIRTUAL_TRY_ON', resolution: 'RES_1K', hasAudio: false, modelVariant: 'NBP', creditsPerUnit: 190, isPerSecond: false },
    { generationType: 'VIRTUAL_TRY_ON', resolution: 'RES_2K', hasAudio: false, modelVariant: 'NBP', creditsPerUnit: 190, isPerSecond: false },
    { generationType: 'VIRTUAL_TRY_ON', resolution: 'RES_4K', hasAudio: false, modelVariant: 'NBP', creditsPerUnit: 250, isPerSecond: false },

    // Face Swap — NB2 (mirrors IMAGE_TO_IMAGE NB2 pricing)
    { generationType: 'FACE_SWAP', resolution: 'RES_1K', hasAudio: false, modelVariant: 'NB2', creditsPerUnit: 90, isPerSecond: false },
    { generationType: 'FACE_SWAP', resolution: 'RES_2K', hasAudio: false, modelVariant: 'NB2', creditsPerUnit: 130, isPerSecond: false },
    { generationType: 'FACE_SWAP', resolution: 'RES_4K', hasAudio: false, modelVariant: 'NB2', creditsPerUnit: 190, isPerSecond: false },
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

  const packageData = [
    // Boost packages (avulsos)
    { name: 'Boost P', update: { credits: 700, priceCents: 1490, sortOrder: 0, stripePriceId: STRIPE.priceBoostP }, create: { name: 'Boost P', credits: 700, priceCents: 1490, sortOrder: 0, stripePriceId: STRIPE.priceBoostP } },
    { name: 'Boost M', update: { credits: 1700, priceCents: 2690, sortOrder: 1, stripePriceId: STRIPE.priceBoostM }, create: { name: 'Boost M', credits: 1700, priceCents: 2690, sortOrder: 1, stripePriceId: STRIPE.priceBoostM } },
    { name: 'Boost G', update: { credits: 3200, priceCents: 3690, sortOrder: 2, stripePriceId: STRIPE.priceBoostG }, create: { name: 'Boost G', credits: 3200, priceCents: 3690, sortOrder: 2, stripePriceId: STRIPE.priceBoostG } },
    // Legacy packages (kept for backward compatibility, marked inactive)
    { name: 'Starter', update: { isActive: false, sortOrder: 90 }, create: { name: 'Starter', credits: 600, priceCents: 3900, sortOrder: 90, isActive: false } },
    { name: 'Creator', update: { isActive: false, sortOrder: 91 }, create: { name: 'Creator', credits: 1600, priceCents: 8900, sortOrder: 91, isActive: false } },
    { name: 'Pro', update: { isActive: false, sortOrder: 92 }, create: { name: 'Pro', credits: 3500, priceCents: 17900, sortOrder: 92, isActive: false } },
    { name: 'Studio', update: { isActive: false, sortOrder: 93 }, create: { name: 'Studio', credits: 8000, priceCents: 36900, sortOrder: 93, isActive: false } },
    { name: 'Pacote 500', update: { isActive: false }, create: { name: 'Pacote 500', credits: 500, priceCents: 1790, sortOrder: 94, isActive: false, stripePriceId: STRIPE.priceCredits500 } },
    { name: 'Pacote 1.000', update: { isActive: false }, create: { name: 'Pacote 1.000', credits: 1000, priceCents: 2990, sortOrder: 95, isActive: false, stripePriceId: STRIPE.priceCredits1000 } },
    { name: 'Pacote 5.000', update: { isActive: false }, create: { name: 'Pacote 5.000', credits: 5000, priceCents: 12990, sortOrder: 96, isActive: false, stripePriceId: STRIPE.priceCredits5000 } },
  ];

  const packages: CreditPackage[] = [];
  for (const pkg of packageData) {
    packages.push(
      await prisma.creditPackage.upsert({
        where: { name: pkg.name },
        update: pkg.update,
        create: pkg.create as any,
      }),
    );
  }

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