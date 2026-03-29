import { Body, Controller, Post } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

class LoginDto {
  @IsNotEmpty()
  username!: string;

  @IsNotEmpty()
  password!: string;
}

class RegisterDto {
  @IsNotEmpty()
  @MinLength(3)
  username!: string;

  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  orgName?: string;

  @IsOptional()
  @IsString()
  orgSlug?: string;
}

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.username, body.password);
  }

  @Public()
  @Post('register')
  async register(@Body() body: RegisterDto) {
    const createOrg = body.orgName && body.orgSlug
      ? { name: body.orgName, slug: body.orgSlug }
      : undefined;
    return this.authService.register(body.username, body.password, body.name, createOrg);
  }
}

