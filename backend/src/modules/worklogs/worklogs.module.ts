import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { WorklogsController } from './worklogs.controller';
import { WorklogsService } from './worklogs.service';

@Module({
  imports: [AccessModule],
  controllers: [WorklogsController],
  providers: [WorklogsService]
})
export class WorklogsModule {}
