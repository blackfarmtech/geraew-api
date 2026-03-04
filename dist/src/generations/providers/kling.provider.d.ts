import { BaseProvider, GenerationInput, GenerationResult } from './base.provider';
export declare class KlingProvider extends BaseProvider {
    private readonly logger;
    generate(input: GenerationInput): Promise<GenerationResult>;
}
