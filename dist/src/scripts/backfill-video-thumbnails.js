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
const uploads_module_1 = require("../uploads/uploads.module");
const uploads_service_1 = require("../uploads/uploads.service");
let BackfillModule = class BackfillModule {
};
BackfillModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule.forRoot({ isGlobal: true }), prisma_module_1.PrismaModule, uploads_module_1.UploadsModule],
    })
], BackfillModule);
const BATCH_SIZE = 5;
const CONCURRENCY = 1;
function extractS3Key(signedUrl, bucketName) {
    try {
        const url = new URL(signedUrl);
        const pathname = url.pathname;
        const bucketPrefix = `/storage/v1/s3/${bucketName}/`;
        const idx = pathname.indexOf(bucketPrefix);
        if (idx !== -1) {
            return pathname.slice(idx + bucketPrefix.length);
        }
        const bucketIdx = pathname.indexOf(`/${bucketName}/`);
        if (bucketIdx !== -1) {
            return pathname.slice(bucketIdx + bucketName.length + 2);
        }
        return null;
    }
    catch {
        return null;
    }
}
async function main() {
    const app = await core_1.NestFactory.createApplicationContext(BackfillModule);
    const prisma = app.get(prisma_service_1.PrismaService);
    const uploads = app.get(uploads_service_1.UploadsService);
    const bucketName = process.env.S3_BUCKET_NAME || 'ai-generations';
    const videoTypes = [
        'TEXT_TO_VIDEO',
        'IMAGE_TO_VIDEO',
        'MOTION_CONTROL',
        'REFERENCE_VIDEO',
    ];
    const total = await prisma.generationOutput.count({
        where: {
            thumbnailUrl: null,
            generation: {
                type: { in: [...videoTypes] },
                status: 'COMPLETED',
                isDeleted: false,
            },
        },
    });
    console.log(`Found ${total} video outputs without thumbnails`);
    if (total === 0) {
        await app.close();
        return;
    }
    let processed = 0;
    let failed = 0;
    const failedIds = new Set();
    while (true) {
        const batch = await prisma.generationOutput.findMany({
            where: {
                thumbnailUrl: null,
                id: { notIn: [...failedIds] },
                generation: {
                    type: { in: [...videoTypes] },
                    status: 'COMPLETED',
                    isDeleted: false,
                },
            },
            select: { id: true, url: true, generationId: true },
            take: BATCH_SIZE,
        });
        if (batch.length === 0)
            break;
        for (let i = 0; i < batch.length; i += CONCURRENCY) {
            const chunk = batch.slice(i, i + CONCURRENCY);
            await Promise.all(chunk.map(async (output) => {
                try {
                    const s3Key = extractS3Key(output.url, bucketName);
                    let freshUrl;
                    if (s3Key) {
                        freshUrl = await uploads.getSignedReadUrl(s3Key);
                    }
                    else {
                        freshUrl = output.url;
                    }
                    const thumbnailUrl = await uploads.generateVideoThumbnail(freshUrl, `thumbnails/${output.generationId}`, `thumb_${output.id}.webp`);
                    const vidRes = await fetch(freshUrl);
                    const vidBuf = vidRes.ok ? Buffer.from(await vidRes.arrayBuffer()) : null;
                    const blurDataUrl = vidBuf ? await uploads.generateBlurDataUrl(vidBuf).catch(() => null) : null;
                    await prisma.generationOutput.update({
                        where: { id: output.id },
                        data: { thumbnailUrl, blurDataUrl },
                    });
                    processed++;
                    console.log(`[${processed + failed}/${total}] ✓ ${output.id}`);
                }
                catch (err) {
                    failed++;
                    failedIds.add(output.id);
                    console.error(`[${processed + failed}/${total}] ✗ ${output.id}: ${err.message}`);
                }
            }));
        }
    }
    console.log(`\nDone! Processed: ${processed}, Failed: ${failed}`);
    await app.close();
}
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=backfill-video-thumbnails.js.map