"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_module_1 = require("../prisma/prisma.module");
const prisma_service_1 = require("../prisma/prisma.service");
let MigrateModule = class MigrateModule {
};
MigrateModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule.forRoot({ isGlobal: true }), prisma_module_1.PrismaModule],
    })
], MigrateModule);
const PUBLIC_BASE = process.env.S3_PUBLIC_URL;
const BUCKET_NAME = process.env.S3_BUCKET_NAME ?? 'ai-generations';
function extractS3Key(url) {
    try {
        const parsed = new URL(url);
        const pathname = parsed.pathname;
        const s3Prefix = `/storage/v1/s3/${BUCKET_NAME}/`;
        const s3Idx = pathname.indexOf(s3Prefix);
        if (s3Idx !== -1) {
            return pathname.slice(s3Idx + s3Prefix.length);
        }
        const pubPrefix = `/storage/v1/object/public/${BUCKET_NAME}/`;
        const pubIdx = pathname.indexOf(pubPrefix);
        if (pubIdx !== -1) {
            return pathname.slice(pubIdx + pubPrefix.length);
        }
        const bucketIdx = pathname.indexOf(`/${BUCKET_NAME}/`);
        if (bucketIdx !== -1) {
            return pathname.slice(bucketIdx + BUCKET_NAME.length + 2);
        }
        return null;
    }
    catch {
        return null;
    }
}
function isSignedUrl(url) {
    return url.includes('X-Amz-') || url.includes('/storage/v1/s3/');
}
function toPublicUrl(key) {
    return `${PUBLIC_BASE.replace(/\/$/, '')}/${key}`;
}
const BATCH_SIZE = 100;
async function main() {
    if (!PUBLIC_BASE) {
        console.error('S3_PUBLIC_URL env var is required');
        process.exit(1);
    }
    const app = await core_1.NestFactory.createApplicationContext(MigrateModule);
    const prisma = app.get(prisma_service_1.PrismaService);
    console.log(`Public base: ${PUBLIC_BASE}`);
    console.log(`Bucket: ${BUCKET_NAME}`);
    console.log('');
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    console.log('=== Migrating generation_outputs.url ===');
    let offset = 0;
    while (true) {
        const outputs = await prisma.generationOutput.findMany({
            select: { id: true, url: true, thumbnailUrl: true },
            skip: offset,
            take: BATCH_SIZE,
            orderBy: { createdAt: 'asc' },
        });
        if (outputs.length === 0)
            break;
        offset += outputs.length;
        for (const output of outputs) {
            const updates = {};
            if (output.url && isSignedUrl(output.url)) {
                const key = extractS3Key(output.url);
                if (key) {
                    updates.url = toPublicUrl(key);
                }
                else {
                    failed++;
                    console.error(`  ✗ Could not extract key from output ${output.id} url`);
                    continue;
                }
            }
            if (output.thumbnailUrl && isSignedUrl(output.thumbnailUrl)) {
                const key = extractS3Key(output.thumbnailUrl);
                if (key) {
                    updates.thumbnailUrl = toPublicUrl(key);
                }
            }
            if (Object.keys(updates).length > 0) {
                await prisma.generationOutput.update({
                    where: { id: output.id },
                    data: updates,
                });
                updated++;
            }
            else {
                skipped++;
            }
        }
        process.stdout.write(`\r  Processed ${offset} outputs (updated: ${updated}, skipped: ${skipped}, failed: ${failed})`);
    }
    console.log(`\n  Done: ${updated} updated, ${skipped} already public, ${failed} failed\n`);
    console.log('=== Migrating generation_input_images.url ===');
    let inputUpdated = 0;
    let inputSkipped = 0;
    offset = 0;
    while (true) {
        const inputs = await prisma.generationInputImage.findMany({
            select: { id: true, url: true },
            skip: offset,
            take: BATCH_SIZE,
            orderBy: { createdAt: 'asc' },
        });
        if (inputs.length === 0)
            break;
        offset += inputs.length;
        for (const input of inputs) {
            if (input.url && isSignedUrl(input.url)) {
                const key = extractS3Key(input.url);
                if (key) {
                    await prisma.generationInputImage.update({
                        where: { id: input.id },
                        data: { url: toPublicUrl(key) },
                    });
                    inputUpdated++;
                }
            }
            else {
                inputSkipped++;
            }
        }
        process.stdout.write(`\r  Processed ${offset} inputs (updated: ${inputUpdated}, skipped: ${inputSkipped})`);
    }
    console.log(`\n  Done: ${inputUpdated} updated, ${inputSkipped} already public\n`);
    console.log('=== Migration complete ===');
    await app.close();
}
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=migrate-signed-to-public-urls.js.map