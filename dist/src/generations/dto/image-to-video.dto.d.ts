import { CreateGenerationDto } from './create-generation.dto';
export declare class ImageToVideoDto extends CreateGenerationDto {
    prompt?: string;
    inputImageUrl: string;
    durationSeconds: number;
    hasAudio?: boolean;
}
