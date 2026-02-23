import { Test, TestingModule } from '@nestjs/testing';
import { FeishuUsersService } from './feishu-users.service';

describe('FeishuUsersService', () => {
  let service: FeishuUsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeishuUsersService],
    }).compile();

    service = module.get<FeishuUsersService>(FeishuUsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
