"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Starting database seed...');
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
            update: {},
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
            },
        }),
        prisma.plan.upsert({
            where: { slug: 'pro' },
            update: {},
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
            },
        }),
        prisma.plan.upsert({
            where: { slug: 'business' },
            update: {},
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
            },
        }),
    ]);
    console.log(`✅ Created ${plans.length} plans`);
    console.log('💰 Creating credit costs...');
    const creditCosts = [
        { generationType: 'TEXT_TO_IMAGE', resolution: 'RES_1K', hasAudio: false, creditsPerUnit: 10, isPerSecond: false },
        { generationType: 'TEXT_TO_IMAGE', resolution: 'RES_2K', hasAudio: false, creditsPerUnit: 15, isPerSecond: false },
        { generationType: 'TEXT_TO_IMAGE', resolution: 'RES_4K', hasAudio: false, creditsPerUnit: 22, isPerSecond: false },
        { generationType: 'IMAGE_TO_IMAGE', resolution: 'RES_1K', hasAudio: false, creditsPerUnit: 10, isPerSecond: false },
        { generationType: 'IMAGE_TO_IMAGE', resolution: 'RES_2K', hasAudio: false, creditsPerUnit: 15, isPerSecond: false },
        { generationType: 'IMAGE_TO_IMAGE', resolution: 'RES_4K', hasAudio: false, creditsPerUnit: 22, isPerSecond: false },
        { generationType: 'MOTION_CONTROL', resolution: 'RES_720P', hasAudio: false, creditsPerUnit: 7, isPerSecond: true },
        { generationType: 'MOTION_CONTROL', resolution: 'RES_1080P', hasAudio: false, creditsPerUnit: 11, isPerSecond: true },
        { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_1080P', hasAudio: false, creditsPerUnit: 48, isPerSecond: true },
        { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_4K', hasAudio: false, creditsPerUnit: 96, isPerSecond: true },
        { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_1080P', hasAudio: false, creditsPerUnit: 48, isPerSecond: true },
        { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_4K', hasAudio: false, creditsPerUnit: 96, isPerSecond: true },
        { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_1080P', hasAudio: true, creditsPerUnit: 96, isPerSecond: true },
        { generationType: 'TEXT_TO_VIDEO', resolution: 'RES_4K', hasAudio: true, creditsPerUnit: 144, isPerSecond: true },
        { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_1080P', hasAudio: true, creditsPerUnit: 96, isPerSecond: true },
        { generationType: 'IMAGE_TO_VIDEO', resolution: 'RES_4K', hasAudio: true, creditsPerUnit: 144, isPerSecond: true },
    ];
    for (const cost of creditCosts) {
        await prisma.creditCost.upsert({
            where: {
                generationType_resolution_hasAudio: {
                    generationType: cost.generationType,
                    resolution: cost.resolution,
                    hasAudio: cost.hasAudio,
                },
            },
            update: {},
            create: cost,
        });
    }
    console.log(`✅ Created ${creditCosts.length} credit costs`);
    console.log('📦 Creating credit packages...');
    const packages = await Promise.all([
        prisma.creditPackage.create({
            data: {
                name: 'Pacote 500',
                credits: 500,
                priceCents: 1790,
                sortOrder: 0,
            },
        }),
        prisma.creditPackage.create({
            data: {
                name: 'Pacote 1.000',
                credits: 1000,
                priceCents: 2990,
                sortOrder: 1,
            },
        }),
        prisma.creditPackage.create({
            data: {
                name: 'Pacote 5.000',
                credits: 5000,
                priceCents: 12990,
                sortOrder: 2,
            },
        }),
    ]);
    console.log(`✅ Created ${packages.length} credit packages`);
    if (process.env.NODE_ENV === 'development') {
        console.log('👤 Creating test users...');
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
        const testUsers = [
            { email: 'free@test.com', name: 'Free User', plan: 'free' },
            { email: 'starter@test.com', name: 'Starter User', plan: 'starter' },
            { email: 'pro@test.com', name: 'Pro User', plan: 'pro' },
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
            const plan = plans.find(p => p.slug === userData.plan);
            if (plan) {
                const now = new Date();
                const endDate = new Date();
                endDate.setMonth(endDate.getMonth() + 1);
                await prisma.subscription.create({
                    data: {
                        userId: user.id,
                        planId: plan.id,
                        status: 'ACTIVE',
                        currentPeriodStart: now,
                        currentPeriodEnd: endDate,
                        paymentProvider: 'stripe',
                    },
                });
                await prisma.creditBalance.create({
                    data: {
                        userId: user.id,
                        planCreditsRemaining: plan.creditsPerMonth,
                        bonusCreditsRemaining: 0,
                        planCreditsUsed: 0,
                        periodStart: now,
                        periodEnd: endDate,
                    },
                });
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
        const proUser = await prisma.user.findUnique({
            where: { email: 'pro@test.com' },
        });
        if (proUser) {
            console.log('🎨 Creating sample generations...');
            const sampleGenerations = [
                {
                    userId: proUser.id,
                    type: 'TEXT_TO_IMAGE',
                    status: 'COMPLETED',
                    prompt: 'A futuristic city skyline at sunset with flying cars',
                    resolution: 'RES_2K',
                    creditsConsumed: 15,
                    outputUrl: 'https://placeholder.com/sample1.jpg',
                    hasWatermark: false,
                    processingTimeMs: 8500,
                    completedAt: new Date(),
                },
                {
                    userId: proUser.id,
                    type: 'TEXT_TO_VIDEO',
                    status: 'COMPLETED',
                    prompt: 'A serene beach with waves crashing',
                    resolution: 'RES_1080P',
                    durationSeconds: 5,
                    hasAudio: true,
                    creditsConsumed: 480,
                    outputUrl: 'https://placeholder.com/sample2.mp4',
                    thumbnailUrl: 'https://placeholder.com/sample2-thumb.jpg',
                    hasWatermark: false,
                    processingTimeMs: 45000,
                    completedAt: new Date(),
                },
                {
                    userId: proUser.id,
                    type: 'IMAGE_TO_IMAGE',
                    status: 'PROCESSING',
                    prompt: 'Transform to cyberpunk style',
                    inputImageUrl: 'https://placeholder.com/input.jpg',
                    resolution: 'RES_1K',
                    creditsConsumed: 10,
                    processingStartedAt: new Date(),
                },
                {
                    userId: proUser.id,
                    type: 'MOTION_CONTROL',
                    status: 'FAILED',
                    inputImageUrl: 'https://placeholder.com/input2.jpg',
                    referenceVideoUrl: 'https://placeholder.com/reference.mp4',
                    resolution: 'RES_1080P',
                    durationSeconds: 3,
                    creditsConsumed: 33,
                    errorMessage: 'Invalid reference video format',
                    errorCode: 'INVALID_FILE_TYPE',
                },
            ];
            for (const gen of sampleGenerations) {
                await prisma.generation.create({
                    data: gen,
                });
            }
            console.log(`✅ Created ${sampleGenerations.length} sample generations`);
        }
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
//# sourceMappingURL=seed.js.map