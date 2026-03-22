import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { MilestoneBoardController } from './milestone-board.controller';
import { MilestoneBoardService } from './milestone-board.service';

@Module({
  imports: [AccessModule],
  controllers: [MilestoneBoardController],
  providers: [MilestoneBoardService]
})
export class MilestoneBoardModule {}
