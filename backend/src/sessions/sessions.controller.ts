import { Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CreateSessionDto } from './dto/create-session.dto';
import { SubmitOrderDto } from './dto/submit-order.dto';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

    @Post()
    create(@Body() createSessionDto: CreateSessionDto) {
        return this.sessionsService.create(createSessionDto.id_skenario);
    }

    @Post('stop')
    async stopActiveSession() {
        return this.sessionsService.stopActive();
    }

    @Get('active')
    async findActive() {
        const session = await this.sessionsService.findActive();
        if (!session) {
            // This line is triggered if no active session is found
            throw new NotFoundException('No active session found.');
        }
        return session;
    }

    @Get(':id/kanban-board')
    async getKanbanBoard(@Param('id', ParseIntPipe) id: number) {
        return this.sessionsService.getKanbanBoardState(id);
    }

    @Post(':id/orders')
    async submitOrder(
        @Param('id', ParseIntPipe) id: number,
        @Body() submitOrderDto: SubmitOrderDto
    ) {
        return this.sessionsService.submitOrder(id, submitOrderDto.items);
    }
}
