export declare class ContentSafetyError extends Error {
    readonly supportCode?: string;
    constructor(message: string, supportCode?: string);
    static readonly SAFETY_CODES: Set<string>;
    static readonly SAFETY_PATTERNS: RegExp[];
    static fromErrorMessage(message: string): ContentSafetyError | null;
}
