import { ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { RolesGuard } from './modules/auth/roles.guard';

function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'backend/.env')
  ];
  const envPath = candidates.find((p) => fs.existsSync(p));
  if (!envPath) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function bootstrap() {
  loadEnv();

  console.log('--- 后端启动环境信息 ---');
  console.log('PORT:', process.env.PORT || 3000);
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('CWD:', process.cwd());
  console.log('------------------------');

  const app = await NestFactory.create(AppModule);

  // 开放 CORS 以支持 Electron 静态文件访问 (file://)
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector, app.get(JwtService)), new RolesGuard(reflector));

  const port = process.env.PORT || 3000;
  const host = process.env.HOST || '127.0.0.1';
  await app.listen(port, host);
  console.log(`Nest application successfully started on port ${port}`);
}

bootstrap();
