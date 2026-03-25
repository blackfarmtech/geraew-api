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
const BATCH_SIZE = 20;
const CONCURRENCY = 5;
async function main() {
    const app = await core_1.NestFactory.createApplicationContext(BackfillModule);
    const prisma = app.get(prisma_service_1.PrismaService);
    const uploads = app.get(uploads_service_1.UploadsService);
    const resetResult = await prisma.$executeRaw `
    UPDATE generation_outputs SET thumbnail_url = NULL
    WHERE thumbnail_url = '' OR thumbnail_url = url
  `;
    if (resetResult > 0) {
        console.log(`Reset ${resetResult} previously failed thumbnails`);
    }
    const total = await prisma.generationOutput.count({
        where: {
            thumbnailUrl: null,
            generation: {
                type: { in: ['TEXT_TO_IMAGE', 'IMAGE_TO_IMAGE'] },
                status: 'COMPLETED',
            },
        },
    });
    console.log(`Found ${total} outputs without thumbnails`);
    if (total === 0) {
        await app.close();
        return;
    }
    let processed = 0;
    let failed = 0;
    while (true) {
        const batch = await prisma.generationOutput.findMany({
            where: {
                thumbnailUrl: null,
                generation: {
                    type: { in: ['TEXT_TO_IMAGE', 'IMAGE_TO_IMAGE'] },
                    status: 'COMPLETED',
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
                    const thumbnailUrl = await uploads.generateThumbnailDirect(output.url, `thumbnails/${output.generationId}`, `thumb_${output.id}.webp`);
                    const imgRes = await fetch(output.url);
                    const imgBuf = imgRes.ok ? Buffer.from(await imgRes.arrayBuffer()) : null;
                    const blurDataUrl = imgBuf ? await uploads.generateBlurDataUrl(imgBuf) : null;
                    await prisma.generationOutput.update({
                        where: { id: output.id },
                        data: { thumbnailUrl, blurDataUrl },
                    });
                    processed++;
                    console.log(`[${processed + failed}/${total}] ✓ ${output.id}`);
                }
                catch (err) {
                    failed++;
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
//# sourceMappingURL=backfill-thumbnails.js.map