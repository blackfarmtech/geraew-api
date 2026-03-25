import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtPayload } from '../common/decorators/current-user.decorator';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    checkAvailability(body: {
        email?: string;
        phone?: string;
    }): Promise<{
        emailTaken: boolean;
        phoneTaken: boolean;
    }>;
    sendVerification(body: {
        phone: string;
    }): Promise<{
        message: string;
    }>;
    register(registerDto: RegisterDto): Promise<AuthResponseDto>;
    login(loginDto: LoginDto): Promise<AuthResponseDto>;
    googleAuth(): Promise<void>;
    googleAuthRedirect(req: any): Promise<AuthResponseDto>;
    googleAuthMobile(googleAuthDto: GoogleAuthDto): Promise<AuthResponseDto>;
    refresh(refreshTokenDto: RefreshTokenDto): Promise<AuthResponseDto>;
    verifyPhone(user: JwtPayload, body: {
        phone: string;
        code: string;
    }): Promise<AuthResponseDto>;
    logout(logoutDto: LogoutDto): Promise<{
        message: string;
    }>;
    verifyEmail(dto: VerifyEmailDto): Promise<{
        message: string;
    }>;
    resendVerification(user: JwtPayload): Promise<{
        message: string;
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
        resetToken?: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
}
