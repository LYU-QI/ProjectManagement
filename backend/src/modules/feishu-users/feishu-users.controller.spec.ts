import { Test, TestingModule } from '@nestjs/testing';
import { FeishuUsersController } from './feishu-users.controller';

describe('FeishuUsersController', () => {
  let controller: FeishuUsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeishuUsersController],
    }).compile();

    controller = module.get<FeishuUsersController>(FeishuUsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
