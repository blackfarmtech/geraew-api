import { CreateGenerationDto } from './create-generation.dto';
export declare class MotionControlDto extends CreateGenerationDto {
    inputImageUrl: string;
    referenceVideoUrl: string;
    durationSeconds: number;
}
