import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [SessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}