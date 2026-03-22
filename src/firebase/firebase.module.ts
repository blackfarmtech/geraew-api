import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirebaseAuthService } from './firebase-auth.service';

@Module({
  imports: [ConfigModule],
  providers: [FirebaseAuthService],
  exports: [FirebaseAuthService],
})
export class FirebaseModule {}
