import { Body, Controller, Post } from '@nestjs/common';
import { IsNotEmpty } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

class LoginDto {
  @IsNotEmpty()
  username!: string;

  @IsNotEmpty()
  password!: string;
}

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.username, body.password);
  }
}
