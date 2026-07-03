import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ScenariosController } from './scenarios.controller';
import { ScenariosService } from './scenarios.service';

@Module({
  imports: [PrismaModule],
  providers: [ScenariosService],
  controllers: [ScenariosController]
})
export class ScenariosModule {}
