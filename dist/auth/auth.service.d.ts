import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { User } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    private readonly configService;
    private readonly logger;
    constructor(prisma: PrismaService, jwtService: JwtService, configService: ConfigService);
    register(registerDto: RegisterDto): Promise<AuthResponseDto>;
    private generateTokens;
    private formatUserResponse;
    validateUser(email: string, password: string): Promise<User | null>;
    login(email: string, password: string): Promise<AuthResponseDto>;
    googleAuthWithToken(googleToken: string): Promise<AuthResponseDto>;
    googleAuth(googleUser: {
        googleId: string;
        email: string;
        name: string;
        avatarUrl?: string;
        provider: string;
    }): Promise<AuthResponseDto>;
    refreshTokens(refreshToken: string): Promise<AuthResponseDto>;
    logout(refreshToken: string): Promise<{
        message: string;
    }>;
    forgotPassword(email: string): Promise<{
        message: string;
        resetToken?: string;
    }>;
    resetPassword(token: string, newPassword: string): Promise<{
        message: string;
    }>;
}
