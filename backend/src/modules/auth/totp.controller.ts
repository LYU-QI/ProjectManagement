import { Controller, Post, Get, Body, Req, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { TotpService } from './totp.service';

class VerifyCodeDto {
  code!: string;
}

@Controller('api/v1/auth/totp')
export class TotpController {
  constructor(private readonly totpService: TotpService) {}

  @Get('status')
  async getStatus(@Req() req: Record<string, unknown>) {
    const user = req.user as { sub?: number } | undefined;
    if (!user?.sub) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.totpService.getTotpStatus(user.sub);
  }

  @Post('setup')
  async setup(@Req() req: Record<string, unknown>) {
    const user = req.user as { sub?: number } | undefined;
    if (!user?.sub) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.totpService.setupTotp(user.sub);
  }

  @Post('verify')
  async verify(@Body() dto: VerifyCodeDto, @Req() req: Record<string, unknown>) {
    const user = req.user as { sub?: number } | undefined;
    if (!user?.sub) {
      throw new UnauthorizedException('Not authenticated');
    }
    await this.totpService.enableTotp(user.sub, dto.code);
    return { success: true };
  }

  @Post('disable')
  async disable(@Body() dto: VerifyCodeDto, @Req() req: Record<string, unknown>) {
    const user = req.user as { sub?: number } | undefined;
    if (!user?.sub) {
      throw new UnauthorizedException('Not authenticated');
    }
    await this.totpService.disableTotp(user.sub, dto.code);
    return { success: true };
  }
}
