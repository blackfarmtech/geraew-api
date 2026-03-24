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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const auth_service_1 = require("./auth.service");
const register_dto_1 = require("./dto/register.dto");
const login_dto_1 = require("./dto/login.dto");
const auth_response_dto_1 = require("./dto/auth-response.dto");
const google_auth_dto_1 = require("./dto/google-auth.dto");
const refresh_token_dto_1 = require("./dto/refresh-token.dto");
const logout_dto_1 = require("./dto/logout.dto");
const forgot_password_dto_1 = require("./dto/forgot-password.dto");
const reset_password_dto_1 = require("./dto/reset-password.dto");
const public_decorator_1 = require("../common/decorators/public.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let AuthController = class AuthController {
    authService;
    constructor(authService) {
        this.authService = authService;
    }
    async checkAvailability(body) {
        return this.authService.checkAvailability(body.email, body.phone);
    }
    async sendVerification(body) {
        await this.authService.sendVerification(body.phone);
        return { message: 'SMS de verificação enviado' };
    }
    async register(registerDto) {
        return this.authService.register(registerDto);
    }
    async login(loginDto) {
        return this.authService.login(loginDto.email, loginDto.password);
    }
    async googleAuth() {
    }
    async googleAuthRedirect(req) {
        return this.authService.googleAuth(req.user);
    }
    async googleAuthMobile(googleAuthDto) {
        return this.authService.googleAuthWithToken(googleAuthDto.googleToken);
    }
    async refresh(refreshTokenDto) {
        return this.authService.refreshTokens(refreshTokenDto.refreshToken);
    }
    async verifyPhone(user, body) {
        return this.authService.verifyPhone(user.sub, body.phone, body.code);
    }
    async logout(logoutDto) {
        return this.authService.logout(logoutDto.refreshToken);
    }
    async forgotPassword(dto) {
        return this.authService.forgotPassword(dto.email);
    }
    async resetPassword(dto) {
        return this.authService.resetPassword(dto.token, dto.password);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('check-availability'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Verifica se email/telefone já estão em uso' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Resultado da verificação' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "checkAvailability", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('send-verification'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Envia SMS de verificação via Twilio' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'SMS enviado com sucesso' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Número inválido ou muitas tentativas' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "sendVerification", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('register'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Registrar novo usuário' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Usuário registrado com sucesso',
        type: auth_response_dto_1.AuthResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 409,
        description: 'Email já cadastrado',
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Dados inválidos',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.RegisterDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Login do usuário' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Login realizado com sucesso',
        type: auth_response_dto_1.AuthResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 401,
        description: 'Email ou senha inválidos',
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Dados inválidos',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('google'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('google')),
    (0, swagger_1.ApiOperation)({ summary: 'Iniciar autenticação com Google OAuth' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Redireciona para página de login do Google',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleAuth", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('google/callback'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('google')),
    (0, swagger_1.ApiOperation)({ summary: 'Callback do Google OAuth' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Autenticação realizada com sucesso',
        type: auth_response_dto_1.AuthResponseDto,
    }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleAuthRedirect", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('google'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Login/Cadastro via Google OAuth (para mobile apps)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Autenticação realizada com sucesso',
        type: auth_response_dto_1.AuthResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Token Google inválido',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [google_auth_dto_1.GoogleAuthDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleAuthMobile", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('refresh'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Renovar access token usando refresh token' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Tokens renovados com sucesso',
        type: auth_response_dto_1.AuthResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 401,
        description: 'Token inválido ou expirado',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [refresh_token_dto_1.RefreshTokenDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.Post)('verify-phone'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Verificar telefone de usuário autenticado (ex: após Google login)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Telefone verificado com sucesso', type: auth_response_dto_1.AuthResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Código inválido' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Telefone já cadastrado' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyPhone", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Logout — revoga refresh token' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Logout realizado com sucesso',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [logout_dto_1.LogoutDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('forgot-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Solicitar reset de senha' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Instruções enviadas (se o email existir)',
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Dados inválidos',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [forgot_password_dto_1.ForgotPasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('reset-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Resetar senha com token' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Senha alterada com sucesso',
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Token inválido ou expirado',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [reset_password_dto_1.ResetPasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resetPassword", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('auth'),
    (0, common_1.Controller)('api/v1/auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map