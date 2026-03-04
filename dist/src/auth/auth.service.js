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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../prisma/prisma.service");
const bcrypt = require("bcrypt");
const crypto_1 = require("crypto");
const config_1 = require("@nestjs/config");
let AuthService = AuthService_1 = class AuthService {
    prisma;
    jwtService;
    configService;
    logger = new common_1.Logger(AuthService_1.name);
    constructor(prisma, jwtService, configService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async register(registerDto) {
        const { email, password, name } = registerDto;
        const existingUser = await this.prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });
        if (existingUser) {
            throw new common_1.ConflictException('Email já cadastrado');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await this.prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    email: email.toLowerCase(),
                    name,
                    passwordHash: hashedPassword,
                    role: 'USER',
                },
            });
            const freePlan = await tx.plan.findFirst({
                where: { slug: 'free' },
            });
            if (!freePlan) {
                throw new common_1.BadRequestException('Plano Free não encontrado. Por favor, execute o seed do banco de dados.');
            }
            const now = new Date();
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            await tx.subscription.create({
                data: {
                    userId: newUser.id,
                    planId: freePlan.id,
                    status: 'ACTIVE',
                    currentPeriodStart: now,
                    currentPeriodEnd: endOfMonth,
                },
            });
            await tx.creditBalance.create({
                data: {
                    userId: newUser.id,
                    planCreditsRemaining: freePlan.creditsPerMonth,
                    bonusCreditsRemaining: 0,
                    planCreditsUsed: 0,
                    periodStart: now,
                    periodEnd: endOfMonth,
                },
            });
            await tx.creditTransaction.create({
                data: {
                    userId: newUser.id,
                    type: 'SUBSCRIPTION_RENEWAL',
                    amount: freePlan.creditsPerMonth,
                    source: 'plan',
                    description: `Créditos iniciais do plano ${freePlan.name}`,
                },
            });
            return newUser;
        });
        const tokens = await this.generateTokens(user);
        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: this.formatUserResponse(user),
        };
    }
    async generateTokens(user) {
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
        };
        const accessToken = await this.jwtService.signAsync(payload, {
            secret: this.configService.get('JWT_ACCESS_SECRET') || 'default-access-secret',
            expiresIn: '15m',
        });
        const refreshToken = (0, crypto_1.randomBytes)(32).toString('hex');
        const refreshTokenHash = (0, crypto_1.createHash)('sha256').update(refreshToken).digest('hex');
        await this.prisma.refreshToken.create({
            data: {
                userId: user.id,
                tokenHash: refreshTokenHash,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });
        return {
            accessToken,
            refreshToken,
        };
    }
    formatUserResponse(user) {
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl || '',
            role: user.role,
            emailVerified: user.emailVerified,
            createdAt: user.createdAt,
        };
    }
    async validateUser(email, password) {
        const user = await this.prisma.user.findUnique({
            where: {
                email: email.toLowerCase(),
                isActive: true,
            },
        });
        if (!user || !user.passwordHash) {
            return null;
        }
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            return null;
        }
        return user;
    }
    async login(email, password) {
        const user = await this.validateUser(email, password);
        if (!user) {
            throw new common_1.UnauthorizedException('Email ou senha inválidos');
        }
        const tokens = await this.generateTokens(user);
        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: this.formatUserResponse(user),
        };
    }
    async googleAuthWithToken(googleToken) {
        try {
            const { OAuth2Client } = await Promise.resolve().then(() => require('google-auth-library'));
            const client = new OAuth2Client(this.configService.get('GOOGLE_CLIENT_ID'));
            const ticket = await client.verifyIdToken({
                idToken: googleToken,
                audience: this.configService.get('GOOGLE_CLIENT_ID'),
            });
            const payload = ticket.getPayload();
            if (!payload || !payload.email) {
                throw new common_1.UnauthorizedException('Token Google inválido');
            }
            return this.googleAuth({
                googleId: payload.sub,
                email: payload.email,
                name: payload.name || payload.email.split('@')[0],
                avatarUrl: payload.picture,
                provider: 'google',
            });
        }
        catch (error) {
            if (error instanceof common_1.UnauthorizedException)
                throw error;
            throw new common_1.UnauthorizedException('Token Google inválido ou expirado');
        }
    }
    async googleAuth(googleUser) {
        let user = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { email: googleUser.email.toLowerCase() },
                    {
                        AND: [
                            { oauthProvider: 'google' },
                            { oauthProviderId: googleUser.googleId }
                        ]
                    }
                ],
            },
        });
        if (user) {
            if (!user.oauthProvider) {
                user = await this.prisma.user.update({
                    where: { id: user.id },
                    data: {
                        oauthProvider: 'google',
                        oauthProviderId: googleUser.googleId,
                        emailVerified: true,
                        avatarUrl: user.avatarUrl || googleUser.avatarUrl,
                    },
                });
            }
        }
        else {
            user = await this.prisma.$transaction(async (tx) => {
                const newUser = await tx.user.create({
                    data: {
                        email: googleUser.email.toLowerCase(),
                        name: googleUser.name,
                        avatarUrl: googleUser.avatarUrl,
                        oauthProvider: 'google',
                        oauthProviderId: googleUser.googleId,
                        emailVerified: true,
                        role: 'USER',
                    },
                });
                const freePlan = await tx.plan.findFirst({
                    where: { slug: 'free' },
                });
                if (!freePlan) {
                    throw new common_1.BadRequestException('Plano Free não encontrado. Por favor, execute o seed do banco de dados.');
                }
                const now = new Date();
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                await tx.subscription.create({
                    data: {
                        userId: newUser.id,
                        planId: freePlan.id,
                        status: 'ACTIVE',
                        currentPeriodStart: now,
                        currentPeriodEnd: endOfMonth,
                    },
                });
                await tx.creditBalance.create({
                    data: {
                        userId: newUser.id,
                        planCreditsRemaining: freePlan.creditsPerMonth,
                        bonusCreditsRemaining: 0,
                        planCreditsUsed: 0,
                        periodStart: now,
                        periodEnd: endOfMonth,
                    },
                });
                await tx.creditTransaction.create({
                    data: {
                        userId: newUser.id,
                        type: 'SUBSCRIPTION_RENEWAL',
                        amount: freePlan.creditsPerMonth,
                        source: 'plan',
                        description: `Créditos iniciais do plano ${freePlan.name}`,
                    },
                });
                return newUser;
            });
        }
        const tokens = await this.generateTokens(user);
        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: this.formatUserResponse(user),
        };
    }
    async refreshTokens(refreshToken) {
        const tokenHash = (0, crypto_1.createHash)('sha256').update(refreshToken).digest('hex');
        const storedToken = await this.prisma.refreshToken.findFirst({
            where: {
                tokenHash,
                revoked: false,
                expiresAt: { gt: new Date() },
            },
        });
        if (!storedToken) {
            throw new common_1.UnauthorizedException('Token inválido ou expirado');
        }
        const user = await this.prisma.user.findUnique({
            where: { id: storedToken.userId, isActive: true },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Usuário não encontrado');
        }
        await this.prisma.refreshToken.update({
            where: { id: storedToken.id },
            data: { revoked: true },
        });
        const tokens = await this.generateTokens(user);
        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: this.formatUserResponse(user),
        };
    }
    async logout(refreshToken) {
        const tokenHash = (0, crypto_1.createHash)('sha256').update(refreshToken).digest('hex');
        await this.prisma.refreshToken.updateMany({
            where: { tokenHash },
            data: { revoked: true },
        });
        return { message: 'Logout realizado com sucesso' };
    }
    async forgotPassword(email) {
        const user = await this.prisma.user.findUnique({
            where: { email: email.toLowerCase(), isActive: true },
        });
        const successMessage = 'Se o email existir, instruções de reset serão enviadas';
        if (!user || !user.passwordHash) {
            return { message: successMessage };
        }
        await this.prisma.passwordResetToken.updateMany({
            where: { userId: user.id, used: false },
            data: { used: true },
        });
        const resetToken = (0, crypto_1.randomBytes)(32).toString('hex');
        const tokenHash = (0, crypto_1.createHash)('sha256').update(resetToken).digest('hex');
        await this.prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                tokenHash,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            },
        });
        const isDev = this.configService.get('NODE_ENV') !== 'production';
        if (isDev) {
            this.logger.debug(`Reset token for ${email}: ${resetToken}`);
        }
        return {
            message: successMessage,
            ...(isDev && { resetToken }),
        };
    }
    async resetPassword(token, newPassword) {
        const tokenHash = (0, crypto_1.createHash)('sha256').update(token).digest('hex');
        const resetToken = await this.prisma.passwordResetToken.findFirst({
            where: {
                tokenHash,
                used: false,
                expiresAt: { gt: new Date() },
            },
        });
        if (!resetToken) {
            throw new common_1.BadRequestException('Token inválido ou expirado');
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: resetToken.userId },
                data: { passwordHash: hashedPassword },
            });
            await tx.passwordResetToken.update({
                where: { id: resetToken.id },
                data: { used: true },
            });
            await tx.refreshToken.updateMany({
                where: { userId: resetToken.userId },
                data: { revoked: true },
            });
        });
        return { message: 'Senha alterada com sucesso' };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map