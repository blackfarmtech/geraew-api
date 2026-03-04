import { HttpException } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes';
export declare class BusinessException extends HttpException {
    constructor(errorCode: ErrorCode, customMessage?: string);
}
