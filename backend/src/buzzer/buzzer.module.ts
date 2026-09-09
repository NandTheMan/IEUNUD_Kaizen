import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { BuzzerService } from './buzzer.service';

@Module({
  imports: [EventsModule],
  providers: [BuzzerService],
  exports: [BuzzerService],
})
export class BuzzerModule {}
