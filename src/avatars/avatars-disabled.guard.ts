import {
  CanActivate,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

/**
 * Bloqueia temporariamente todas as rotas de usuário de /api/v1/avatars
 * (a tela de Avatar está "Em breve" no front). Webhook da HeyGen, fila e cron
 * de avatares presos seguem ativos para que treinamentos/vídeos já em
 * andamento terminem ou sejam reembolsados normalmente.
 * Para reativar, remover o @UseGuards(AvatarsDisabledGuard) do AvatarsController.
 */
@Injectable()
export class AvatarsDisabledGuard implements CanActivate {
  canActivate(): boolean {
    throw new HttpException(
      {
        code: 'FEATURE_DISABLED',
        message: 'Avatar estará disponível em breve.',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
