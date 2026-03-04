import { BaseProvider, GenerationInput, GenerationResult } from './base.provider';
export declare class VeoProvider extends BaseProvider {
    private readonly logger;
    generate(input: GenerationInput): Promise<GenerationResult>;
}
