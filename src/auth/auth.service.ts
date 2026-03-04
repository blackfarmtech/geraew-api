import { Injectable, ConflictException, UnauthorizedException, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { randomBytes, createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  /**
   * Registra um novo usuário
   */
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, name } = registerDto;

    // Verifica se o email já está em uso
    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email já cadastrado');
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Cria o usuário e o saldo de créditos em uma transação
    const user = await this.prisma.$transaction(async (tx) => {
      // Cria o usuário
      const newUser = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          name,
          passwordHash: hashedPassword,
          role: 'USER',
        },
      });

      // Busca o plano Free
      const freePlan = await tx.plan.findFirst({
        where: { slug: 'free' },
      });

      if (!freePlan) {
        throw new BadRequestException('Plano Free não encontrado. Por favor, execute o seed do banco de dados.');
      }

      // Cria a assinatura Free
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

      // Cria o saldo inicial de créditos
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

      // Registra a transação de créditos iniciais
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

    // Gera os tokens
    const tokens = await this.generateTokens(user);

    // Retorna a resposta formatada
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.formatUserResponse(user),
    };
  }

  /**
   * Gera tokens JWT
   */
  private async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // Gera access token (15 minutos)
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET') || 'default-access-secret',
      expiresIn: '15m',
    });

    // Gera refresh token (7 dias)
    const refreshToken = randomBytes(32).toString('hex');
    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');

    // Salva o refresh token no banco
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Formata a resposta do usuário
   */
  private formatUserResponse(user: User): UserResponseDto {
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

  /**
   * Valida um usuário por email e senha
   */
  async validateUser(email: string, password: string): Promise<User | null> {
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

  /**
   * Login do usuário
   */
  async login(email: string, password: string): Promise<AuthResponseDto> {
    const user = await this.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    const tokens = await this.generateTokens(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.formatUserResponse(user),
    };
  }

  /**
   * Login/Cadastro via Google OAuth (mobile — verifica ID token)
   */
  async googleAuthWithToken(googleToken: string): Promise<AuthResponseDto> {
    try {
      const { OAuth2Client } = await import('google-auth-library');
      const client = new OAuth2Client(this.configService.get('GOOGLE_CLIENT_ID'));

      const ticket = await client.verifyIdToken({
        idToken: googleToken,
        audience: this.configService.get('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();

      if (!payload || !payload.email) {
        throw new UnauthorizedException('Token Google inválido');
      }

      return this.googleAuth({
        googleId: payload.sub,
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        avatarUrl: payload.picture,
        provider: 'google',
      });
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Token Google inválido ou expirado');
    }
  }

  /**
   * Login/Cadastro via Google OAuth
   */
  async googleAuth(googleUser: {
    googleId: string;
    email: string;
    name: string;
    avatarUrl?: string;
    provider: string;
  }): Promise<AuthResponseDto> {
    // Busca usuário existente por email ou Google ID
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
      // Se o usuário existe mas não tinha OAuth, atualiza
      if (!user.oauthProvider) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            oauthProvider: 'google',
            oauthProviderId: googleUser.googleId,
            emailVerified: true, // Google já verifica o email
            avatarUrl: user.avatarUrl || googleUser.avatarUrl,
          },
        });
      }
    } else {
      // Cria novo usuário via Google OAuth
      user = await this.prisma.$transaction(async (tx) => {
        // Cria o usuário
        const newUser = await tx.user.create({
          data: {
            email: googleUser.email.toLowerCase(),
            name: googleUser.name,
            avatarUrl: googleUser.avatarUrl,
            oauthProvider: 'google',
            oauthProviderId: googleUser.googleId,
            emailVerified: true, // Google já verifica o email
            role: 'USER',
          },
        });

        // Busca o plano Free
        const freePlan = await tx.plan.findFirst({
          where: { slug: 'free' },
        });

        if (!freePlan) {
          throw new BadRequestException('Plano Free não encontrado. Por favor, execute o seed do banco de dados.');
        }

        // Cria a assinatura Free
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

        // Cria o saldo inicial de créditos
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

        // Registra a transação de créditos iniciais
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

    // Gera os tokens
    const tokens = await this.generateTokens(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.formatUserResponse(user),
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthResponseDto> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: storedToken.userId, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    // Generate new tokens
    const tokens = await this.generateTokens(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.formatUserResponse(user),
    };
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revoked: true },
    });

    return { message: 'Logout realizado com sucesso' };
  }

  /**
   * Solicita reset de senha — gera token e retorna (dev) ou envia email (prod)
   */
  async forgotPassword(email: string): Promise<{ message: string; resetToken?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase(), isActive: true },
    });

    const successMessage = 'Se o email existir, instruções de reset serão enviadas';

    // Não revela se o email existe ou se é conta OAuth-only
    if (!user || !user.passwordHash) {
      return { message: successMessage };
    }

    // Invalida tokens de reset anteriores
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    // Gera novo token de reset
    const resetToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(resetToken).digest('hex');

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutos
      },
    });

    // Em dev, loga e retorna o token para testes
    const isDev = this.configService.get('NODE_ENV') !== 'production';
    if (isDev) {
      this.logger.debug(`Reset token for ${email}: ${resetToken}`);
    }

    return {
      message: successMessage,
      ...(isDev && { resetToken }),
    };
  }

  /**
   * Reseta a senha do usuário usando o token de reset
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetToken) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      // Atualiza a senha
      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: hashedPassword },
      });

      // Invalida o token de reset
      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      });

      // Revoga todos os refresh tokens por segurança
      await tx.refreshToken.updateMany({
        where: { userId: resetToken.userId },
        data: { revoked: true },
      });
    });

    return { message: 'Senha alterada com sucesso' };
  }
}