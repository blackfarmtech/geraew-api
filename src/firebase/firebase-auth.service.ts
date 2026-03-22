import { Injectable, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class FirebaseAuthService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAuthService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    if (admin.apps.length === 0) {
      try {
        // Tenta carregar do arquivo JSON do service account
        const serviceAccountPath = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
        const possiblePaths = serviceAccountPath
          ? [serviceAccountPath]
          : [
              join(process.cwd(), 'geraew-90549-firebase-adminsdk-fbsvc-8a5fa1eed4.json'),
            ];

        const foundPath = possiblePaths.find((p) => existsSync(p));

        if (foundPath) {
          const serviceAccount = JSON.parse(readFileSync(foundPath, 'utf8'));
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
          this.logger.log(`Firebase Admin SDK initialized from ${foundPath}`);
          return;
        }

        // Fallback: env vars individuais
        const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
        const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
        const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

        if (projectId && clientEmail && privateKey) {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId,
              clientEmail,
              privateKey: privateKey.replace(/\\n/g, '\n'),
            }),
          });
          this.logger.log('Firebase Admin SDK initialized from env vars');
        } else {
          this.logger.warn('Firebase credentials not configured — phone verification will be unavailable');
        }
      } catch (error) {
        this.logger.error(`Failed to initialize Firebase Admin SDK: ${error}`);
        this.logger.warn('Phone verification will be unavailable');
      }
    }
  }

  /**
   * Verifica o Firebase ID Token e retorna o número de telefone verificado
   */
  async verifyPhoneToken(idToken: string): Promise<string> {
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);

      if (!decodedToken.phone_number) {
        throw new BadRequestException('Token Firebase não contém número de telefone verificado');
      }

      return decodedToken.phone_number;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;

      this.logger.error(`Firebase token verification failed: ${error}`);
      throw new BadRequestException('Token de verificação inválido ou expirado');
    }
  }
}
