import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('Health (e2e)', () => {
  it('/GET health returns 200', async () => {
    const response = await request(BASE_URL)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status');
  });
});
