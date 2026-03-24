"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentSafetyError = void 0;
class ContentSafetyError extends Error {
    supportCode;
    constructor(message, supportCode) {
        super(message);
        this.name = 'ContentSafetyError';
        this.supportCode = supportCode;
    }
    static SAFETY_CODES = new Set([
        '58061214', '17301594',
        '29310472', '15236754',
        '64151117', '42237218',
        '62263041',
        '57734940', '22137204',
        '74803281', '29578790', '42876398',
        '89371032', '49114662', '63429089', '72817394', '60599140',
        '35561574', '35561575',
        '90789179', '43188360',
        '78610348',
        '61493863', '56562880',
        '32635315',
    ]);
    static SAFETY_PATTERNS = [
        /violat.*polic/i,
        /couldn.*t be submitted/i,
        /diretrizes de uso/i,
        /safety.*filter/i,
        /content.*policy/i,
        /responsible\s*ai/i,
        /blocked.*safety/i,
        /support.*code/i,
        /não pôde gerar/i,
    ];
    static fromErrorMessage(message) {
        for (const code of ContentSafetyError.SAFETY_CODES) {
            if (message.includes(code)) {
                return new ContentSafetyError(message, code);
            }
        }
        for (const pattern of ContentSafetyError.SAFETY_PATTERNS) {
            if (pattern.test(message)) {
                return new ContentSafetyError(message);
            }
        }
        return null;
    }
}
exports.ContentSafetyError = ContentSafetyError;
//# sourceMappingURL=content-safety.error.js.map