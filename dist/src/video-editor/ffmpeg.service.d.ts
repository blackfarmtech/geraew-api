export interface ClipInput {
    filePath: string;
    startMs: number;
    endMs?: number;
}
export declare class FfmpegService {
    private readonly logger;
    trimAndConcat(clips: ClipInput[], outputPath: string): Promise<void>;
    getVideoDuration(filePath: string): Promise<number>;
    private trimClip;
    private trimClipReencode;
    private concatClips;
    private concatClipsReencode;
}
