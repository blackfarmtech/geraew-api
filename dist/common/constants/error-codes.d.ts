import { HttpStatus } from '@nestjs/common';
export declare const ErrorCodes: {
    readonly INSUFFICIENT_CREDITS: {
        readonly code: "INSUFFICIENT_CREDITS";
        readonly statusCode: HttpStatus.PAYMENT_REQUIRED;
        readonly message: "Créditos insuficientes";
    };
    readonly MAX_CONCURRENT_REACHED: {
        readonly code: "MAX_CONCURRENT_REACHED";
        readonly statusCode: HttpStatus.TOO_MANY_REQUESTS;
        readonly message: "Limite de gerações simultâneas atingido";
    };
    readonly INVALID_FILE_TYPE: {
        readonly code: "INVALID_FILE_TYPE";
        readonly statusCode: HttpStatus.BAD_REQUEST;
        readonly message: "Tipo de arquivo não suportado";
    };
    readonly FILE_TOO_LARGE: {
        readonly code: "FILE_TOO_LARGE";
        readonly statusCode: HttpStatus.BAD_REQUEST;
        readonly message: "Arquivo excede tamanho máximo";
    };
    readonly GENERATION_FAILED: {
        readonly code: "GENERATION_FAILED";
        readonly statusCode: HttpStatus.INTERNAL_SERVER_ERROR;
        readonly message: "Erro na geração";
    };
    readonly GENERATION_TIMEOUT: {
        readonly code: "GENERATION_TIMEOUT";
        readonly statusCode: HttpStatus.GATEWAY_TIMEOUT;
        readonly message: "Timeout na geração";
    };
    readonly PLAN_UPGRADE_REQUIRED: {
        readonly code: "PLAN_UPGRADE_REQUIRED";
        readonly statusCode: HttpStatus.FORBIDDEN;
        readonly message: "Feature não disponível no plano atual";
    };
    readonly SUBSCRIPTION_PAST_DUE: {
        readonly code: "SUBSCRIPTION_PAST_DUE";
        readonly statusCode: HttpStatus.PAYMENT_REQUIRED;
        readonly message: "Pagamento pendente";
    };
    readonly NSFW_CONTENT_DETECTED: {
        readonly code: "NSFW_CONTENT_DETECTED";
        readonly statusCode: HttpStatus.BAD_REQUEST;
        readonly message: "Conteúdo NSFW detectado no prompt";
    };
    readonly PROMPT_TOO_LONG: {
        readonly code: "PROMPT_TOO_LONG";
        readonly statusCode: HttpStatus.BAD_REQUEST;
        readonly message: "Prompt excede limite de caracteres";
    };
};
export type ErrorCode = keyof typeof ErrorCodes;
