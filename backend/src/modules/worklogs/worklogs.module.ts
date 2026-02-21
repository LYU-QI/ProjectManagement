import { Module } from '@nestjs/common';
import { WorklogsController } from './worklogs.controller';
import { WorklogsService } from './worklogs.service';

@Module({
  controllers: [WorklogsController],
  providers: [WorklogsService]
})
export class WorklogsModule {}
