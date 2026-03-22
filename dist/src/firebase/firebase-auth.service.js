"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var FirebaseAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirebaseAuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const admin = require("firebase-admin");
const fs_1 = require("fs");
const path_1 = require("path");
let FirebaseAuthService = FirebaseAuthService_1 = class FirebaseAuthService {
    configService;
    logger = new common_1.Logger(FirebaseAuthService_1.name);
    constructor(configService) {
        this.configService = configService;
    }
    onModuleInit() {
        if (admin.apps.length === 0) {
            try {
                const serviceAccountPath = this.configService.get('FIREBASE_SERVICE_ACCOUNT_PATH');
                const possiblePaths = serviceAccountPath
                    ? [serviceAccountPath]
                    : [
                        (0, path_1.join)(process.cwd(), 'geraew-90549-firebase-adminsdk-fbsvc-8a5fa1eed4.json'),
                    ];
                const foundPath = possiblePaths.find((p) => (0, fs_1.existsSync)(p));
                if (foundPath) {
                    const serviceAccount = JSON.parse((0, fs_1.readFileSync)(foundPath, 'utf8'));
                    admin.initializeApp({
                        credential: admin.credential.cert(serviceAccount),
                    });
                    this.logger.log(`Firebase Admin SDK initialized from ${foundPath}`);
                    return;
                }
                const projectId = this.configService.get('FIREBASE_PROJECT_ID');
                const clientEmail = this.configService.get('FIREBASE_CLIENT_EMAIL');
                const privateKey = this.configService.get('FIREBASE_PRIVATE_KEY');
                if (projectId && clientEmail && privateKey) {
                    admin.initializeApp({
                        credential: admin.credential.cert({
                            projectId,
                            clientEmail,
                            privateKey: privateKey.replace(/\\n/g, '\n'),
                        }),
                    });
                    this.logger.log('Firebase Admin SDK initialized from env vars');
                }
                else {
                    this.logger.warn('Firebase credentials not configured — phone verification will be unavailable');
                }
            }
            catch (error) {
                this.logger.error(`Failed to initialize Firebase Admin SDK: ${error}`);
                this.logger.warn('Phone verification will be unavailable');
            }
        }
    }
    async verifyPhoneToken(idToken) {
        try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            if (!decodedToken.phone_number) {
                throw new common_1.BadRequestException('Token Firebase não contém número de telefone verificado');
            }
            return decodedToken.phone_number;
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException)
                throw error;
            this.logger.error(`Firebase token verification failed: ${error}`);
            throw new common_1.BadRequestException('Token de verificação inválido ou expirado');
        }
    }
};
exports.FirebaseAuthService = FirebaseAuthService;
exports.FirebaseAuthService = FirebaseAuthService = FirebaseAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FirebaseAuthService);
//# sourceMappingURL=firebase-auth.service.js.map