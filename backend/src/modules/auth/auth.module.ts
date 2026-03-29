import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TotpController } from './totp.controller';
import { TotpService } from './totp.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'projectlvqi-dev-secret',
      signOptions: { expiresIn: '7d' }
    })
  ],
  controllers: [AuthController, TotpController],
  providers: [AuthService, TotpService, PrismaService],
  exports: [JwtModule, TotpService]
})
export class AuthModule {}
