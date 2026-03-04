export declare enum UploadPurpose {
    GENERATION_INPUT = "generation_input",
    REFERENCE_VIDEO = "reference_video"
}
declare const ALLOWED_CONTENT_TYPES: readonly ["image/png", "image/jpeg", "image/webp", "video/mp4"];
export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];
export declare class PresignedUrlDto {
    filename: string;
    contentType: AllowedContentType;
    purpose: UploadPurpose;
}
export {};
