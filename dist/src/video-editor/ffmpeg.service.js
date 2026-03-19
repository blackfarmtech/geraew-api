"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var FfmpegService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FfmpegService = void 0;
const common_1 = require("@nestjs/common");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const fs = require("fs");
const path = require("path");
const crypto_1 = require("crypto");
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
let FfmpegService = FfmpegService_1 = class FfmpegService {
    logger = new common_1.Logger(FfmpegService_1.name);
    async trimAndConcat(clips, outputPath) {
        const tempDir = path.join('/tmp', `ffmpeg-${(0, crypto_1.randomUUID)()}`);
        fs.mkdirSync(tempDir, { recursive: true });
        const trimmedFiles = [];
        try {
            for (let i = 0; i < clips.length; i++) {
                const clip = clips[i];
                const needsTrim = clip.startMs > 0 || clip.endMs != null;
                if (!needsTrim) {
                    trimmedFiles.push(clip.filePath);
                    continue;
                }
                const trimmedPath = path.join(tempDir, `trimmed-${i}.mp4`);
                await this.trimClip(clip, trimmedPath);
                trimmedFiles.push(trimmedPath);
            }
            if (trimmedFiles.length === 1) {
                fs.copyFileSync(trimmedFiles[0], outputPath);
                return;
            }
            await this.concatClips(trimmedFiles, outputPath, tempDir);
        }
        finally {
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
            catch (e) {
                this.logger.warn(`Failed to clean up temp dir ${tempDir}: ${e.message}`);
            }
        }
    }
    async getVideoDuration(filePath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err)
                    return reject(err);
                const durationSec = metadata.format.duration ?? 0;
                resolve(Math.round(durationSec * 1000));
            });
        });
    }
    trimClip(clip, outputPath) {
        return new Promise((resolve, reject) => {
            const startSec = clip.startMs / 1000;
            let cmd = ffmpeg(clip.filePath).setStartTime(startSec);
            if (clip.endMs != null) {
                const durationSec = (clip.endMs - clip.startMs) / 1000;
                cmd = cmd.setDuration(durationSec);
            }
            cmd
                .outputOptions(['-c', 'copy', '-avoid_negative_ts', 'make_zero'])
                .output(outputPath)
                .on('end', () => resolve())
                .on('error', (err) => {
                this.logger.warn(`Trim with -c copy failed, re-encoding: ${err.message}`);
                this.trimClipReencode(clip, outputPath).then(resolve).catch(reject);
            })
                .run();
        });
    }
    trimClipReencode(clip, outputPath) {
        return new Promise((resolve, reject) => {
            const startSec = clip.startMs / 1000;
            let cmd = ffmpeg(clip.filePath).setStartTime(startSec);
            if (clip.endMs != null) {
                const durationSec = (clip.endMs - clip.startMs) / 1000;
                cmd = cmd.setDuration(durationSec);
            }
            cmd
                .outputOptions(['-avoid_negative_ts', 'make_zero'])
                .output(outputPath)
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run();
        });
    }
    concatClips(filePaths, outputPath, tempDir) {
        return new Promise((resolve, reject) => {
            const concatFilePath = path.join(tempDir, 'concat.txt');
            const concatContent = filePaths
                .map((fp) => `file '${fp}'`)
                .join('\n');
            fs.writeFileSync(concatFilePath, concatContent);
            ffmpeg()
                .input(concatFilePath)
                .inputOptions(['-f', 'concat', '-safe', '0'])
                .outputOptions(['-c', 'copy'])
                .output(outputPath)
                .on('end', () => resolve())
                .on('error', (err) => {
                this.logger.warn(`Concat with -c copy failed, re-encoding: ${err.message}`);
                this.concatClipsReencode(filePaths, outputPath, tempDir)
                    .then(resolve)
                    .catch(reject);
            })
                .run();
        });
    }
    concatClipsReencode(filePaths, outputPath, tempDir) {
        return new Promise((resolve, reject) => {
            const concatFilePath = path.join(tempDir, 'concat-reencode.txt');
            const concatContent = filePaths
                .map((fp) => `file '${fp}'`)
                .join('\n');
            fs.writeFileSync(concatFilePath, concatContent);
            ffmpeg()
                .input(concatFilePath)
                .inputOptions(['-f', 'concat', '-safe', '0'])
                .output(outputPath)
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run();
        });
    }
};
exports.FfmpegService = FfmpegService;
exports.FfmpegService = FfmpegService = FfmpegService_1 = __decorate([
    (0, common_1.Injectable)()
], FfmpegService);
//# sourceMappingURL=ffmpeg.service.js.map