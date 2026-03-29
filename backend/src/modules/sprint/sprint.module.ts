import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { SprintController } from './sprint.controller';
import { SprintService } from './sprint.service';

@Module({
  imports: [AccessModule],
  controllers: [SprintController],
  providers: [SprintService]
})
export class SprintModule {}
