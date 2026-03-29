import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  root() {
    return { service: 'projectlvqi-backend', version: process.env.npm_package_version ?? '1.0.0' };
  }
}
