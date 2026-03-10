import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Stripe Price IDs — lidos do .env (dev usa test IDs, prod usa live IDs)
const STRIPE = {
  priceStarter: process.env.STRIPE_PRICE_STARTER ?? '',
  pricePro: process.env.STRIPE_PRICE_PRO ?? '',
  priceBusiness: process.env.STRIPE_PRICE_BUSINESS ?? '',
  priceCredits500: process.env.STRIPE_PRICE_CREDITS_500 ?? '',
  priceCredits1000: process.env.STRIPE_PRICE_CREDITS_1000 ?? '',
  priceCredits5000: process.env.STRIPE_PRICE_CREDITS_5000 ?? '',
};

async function main() {
  console.log('🌱 Starting database seed...');

  // ============================================
  // Seed Plans
  // ============================================
  console.log('📋 Creating plans...');

  const plans = await Promise.all([
    prisma.plan.upsert({
      where: { slug: 'free' },
      update: {},
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
      update: { stripePriceId: STRIPE.priceStarter },
      create: {
        slug: 'starter',
        name: 'Starter',
        priceCents: 2990,
        creditsPerMonth: 1000,
        maxConcurrentGenerations: 2,
        hasWatermark: false,
        galleryRetentionDays: null,
        hasApiAccess: false,
        sortOrder: 1,
        stripePriceId: STRIPE.priceStarter,
      },
    }),
    prisma.plan.upsert({
      where: { slug: 'pro' },
      update: { stripePriceId: STRIPE.pricePro },
      create: {
        slug: 'pro',
        name: 'Pro',
        priceCents: 8990,
        creditsPerMonth: 3500,
        maxConcurrentGenerations: 5,
        hasWatermark: false,
        galleryRetentionDays: null,
        hasApiAccess: false,
        sortOrder: 2,
        stripePriceId: STRIPE.pricePro,
      },
    }),
    prisma.plan.upsert({
      where: { slug: 'business' },
      update: { stripePriceId: STRIPE.priceBusiness },
      create: {
        slug: 'business',
        name: 'Business',
        priceCents: 24990,
        creditsPerMonth: 10000,
        maxConcurrentGenerations: 10,
        hasWatermark: false,
        galleryRetentionDays: null,
        hasApiAccess: true,
        sortOrder: 3,
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
    // Text to Image
    { generationType: 'TEXT_TO_IMAGE', resolution: 'RES_1K', hasAudio: false, creditsPerUnit: 10, isPerSecond: false },
    { generationType: 'TEXT_TO_IMAGE', resolution: 'RES_2K', hasAudio: false, creditsPerUnit: 15, isPerSecond: false },
    { generationType: 'TEXT_TO_IMAGE', resolution: 'RES_4K', hasAudio: false, creditsPerUnit: 22, isPerSecond: false },

    // Image to Image
    { generationType: 'IMAGE_TO_IMAGE', resolution: 'RES_1K', hasAudio: false, creditsPerUnit: 10, isPerSecond: false },
    { generationType: 'IMAGE_TO_IMAGE', resolution: 'RES_2K', hasAudio: false, creditsPerUnit: 15, isPerSecond: false },
    { generationType: 'IMAGE_TO_IMAGE', resolution: 'RES_4K', hasAudio: false, creditsPerUnit: 22, isPerSecond: false },

    // Motion Control (Kling 2.6)
    { generationType: 'MOTION_CONTROL', resolution: 'RES_720P', hasAudio: false, creditsPerUnit: 7, isPerSecond: true },
    { generationType: 'MOTION_CONTROL', resolution: 'RES_1080P', hasAudio: false, creditsPerUnit: 11, isPerSecond: true },

    // Text to Video without audio (Veo 3.1)
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_1080P', hasAudio: false, creditsPerUnit: 48, isPerSecond: true },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_4K', hasAudio: false, creditsPerUnit: 96, isPerSecond: true },

    // Image to Video without audio (Veo 3.1)
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_1080P', hasAudio: false, creditsPerUnit: 48, isPerSecond: true },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_4K', hasAudio: false, creditsPerUnit: 96, isPerSecond: true },

    // Text to Video with audio (Veo 3.1)
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_1080P', hasAudio: true, creditsPerUnit: 96, isPerSecond: true },
    { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_4K', hasAudio: true, creditsPerUnit: 144, isPerSecond: true },

    // Image to Video with audio (Veo 3.1)
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_1080P', hasAudio: true, creditsPerUnit: 96, isPerSecond: true },
    { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_4K', hasAudio: true, creditsPerUnit: 144, isPerSecond: true },

    // Reference Video without audio (Veo 3.1)
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_720P', hasAudio: false, creditsPerUnit: 48, isPerSecond: true },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_1080P', hasAudio: false, creditsPerUnit: 48, isPerSecond: true },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_4K', hasAudio: false, creditsPerUnit: 96, isPerSecond: true },

    // Reference Video with audio (Veo 3.1)
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_1080P', hasAudio: true, creditsPerUnit: 96, isPerSecond: true },
    { generationType: 'REFERENCE_VIDEO', resolution: 'RES_4K', hasAudio: true, creditsPerUnit: 144, isPerSecond: true },
  ];

  for (const cost of creditCosts) {
    await prisma.creditCost.upsert({
      where: {
        generationType_resolution_hasAudio: {
          generationType: cost.generationType as any,
          resolution: cost.resolution as any,
          hasAudio: cost.hasAudio,
        },
      },
      update: {},
      create: cost as any,
    });
  }

  console.log(`✅ Created ${creditCosts.length} credit costs`);

  // ============================================
  // Seed Credit Packages
  // ============================================
  console.log('📦 Creating credit packages...');

  const packages = await Promise.all([
    prisma.creditPackage.upsert({
      where: { name: 'Pacote 500' },
      update: { stripePriceId: STRIPE.priceCredits500 },
      create: {
        name: 'Pacote 500',
        credits: 500,
        priceCents: 1790,
        sortOrder: 0,
        stripePriceId: STRIPE.priceCredits500,
      },
    }),
    prisma.creditPackage.upsert({
      where: { name: 'Pacote 1.000' },
      update: { stripePriceId: STRIPE.priceCredits1000 },
      create: {
        name: 'Pacote 1.000',
        credits: 1000,
        priceCents: 2990,
        sortOrder: 1,
        stripePriceId: STRIPE.priceCredits1000,
      },
    }),
    prisma.creditPackage.upsert({
      where: { name: 'Pacote 5.000' },
      update: { stripePriceId: STRIPE.priceCredits5000 },
      create: {
        name: 'Pacote 5.000',
        credits: 5000,
        priceCents: 12990,
        sortOrder: 2,
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