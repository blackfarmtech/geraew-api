"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessException = void 0;
const common_1 = require("@nestjs/common");
const error_codes_1 = require("../constants/error-codes");
class BusinessException extends common_1.HttpException {
    constructor(errorCode, customMessage) {
        const error = error_codes_1.ErrorCodes[errorCode];
        super({
            code: error.code,
            message: customMessage || error.message,
            statusCode: error.statusCode,
        }, error.statusCode);
    }
}
exports.BusinessException = BusinessException;
//# sourceMappingURL=business.exception.js.map