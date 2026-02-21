import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { username }
    });
    if (!user || !user.password || user.password !== password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      name: user.name,
      role: user.role
    };
    const token = await this.jwtService.signAsync(payload);
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role
      }
    };
  }
}
