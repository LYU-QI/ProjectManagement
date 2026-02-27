import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { RequirementsController } from './requirements.controller';
import { RequirementsService } from './requirements.service';

@Module({
  imports: [AccessModule],
  controllers: [RequirementsController],
  providers: [RequirementsService]
})
export class RequirementsModule {}
