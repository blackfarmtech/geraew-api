import { CreateGenerationDto } from './create-generation.dto';
export declare class TextToVideoDto extends CreateGenerationDto {
    prompt: string;
    durationSeconds: number;
    hasAudio?: boolean;
    referenceImageUrls?: string[];
}
