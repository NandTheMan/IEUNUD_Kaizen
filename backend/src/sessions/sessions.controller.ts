import { Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CreateSessionDto } from './dto/create-session.dto';
import { DecrementStockDto } from './dto/decrement-stock.dto';
import { ReportAndonDto } from './dto/report-andon.dto';
import { ReportNgDto } from './dto/report-ng.dto';
import { ShipOrderDto } from './dto/ship-order.dto';
import { SubmitOrderDto } from './dto/submit-order.dto';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

    @Post()
    create(@Body() createSessionDto: CreateSessionDto) {
        return this.sessionsService.create(createSessionDto.id_skenario);
    }

    @Post('prepare-game')
    async prepareGame(@Body() createSessionDto: CreateSessionDto) {
        return this.sessionsService.prepareGame(createSessionDto.id_skenario);
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

    @Get(':id/andon-alerts')
    async getAndonAlerts(@Param('id', ParseIntPipe) id: number) {
        return this.sessionsService.getAndonAlerts(id);
    }

    @Get(':id/workstations/:wsId/stock')
    async getWorkstationStock(
        @Param('id', ParseIntPipe) sessionId: number,
        @Param('wsId') wsId: string,
    ) {
        return this.sessionsService.getWorkstationStock(sessionId, wsId);
    }

    @Post(':id/orders')
    async submitOrder(
        @Param('id', ParseIntPipe) id: number,
        @Body() submitOrderDto: SubmitOrderDto
    ) {
        return this.sessionsService.submitOrder(id, submitOrderDto.items);
    }

    @Post(':id/ship')
    async shipOrder(@Param('id', ParseIntPipe) id: number, @Body() shipOrderDto: ShipOrderDto) {
        return this.sessionsService.shipOrder(id, shipOrderDto.logSiklusId, shipOrderDto.heijunkaId);
    }

    @Post(':id/workstations/:wsId/toggle')
    async toggleWorkstation(
        @Param('id', ParseIntPipe) sessionId: number,
        @Param('wsId') wsId: string
    ) {
        return this.sessionsService.toggleWorkstation(sessionId, wsId);
    }

    @Post(':id/workstations/:wsId/decrement-stock')
    async decrementStock(
        @Param('id', ParseIntPipe) sessionId: number,
        @Param('wsId') wsId: string,
        @Body() decrementStockDto: DecrementStockDto,
    ) {
        const { id_bahan, jumlah } = decrementStockDto;
        return this.sessionsService.decrementWorkstationStock(sessionId, wsId, id_bahan, jumlah);
    }

    @Post(':id/workstations/:wsId/report-ng')
    async reportNg(
        @Param('id', ParseIntPipe) sessionId: number,
        @Param('wsId') wsId: string,
        @Body() reportNgDto: ReportNgDto,
    ) {
        return this.sessionsService.reportNg(sessionId, wsId, reportNgDto.alasan_ng);
    }

    @Post(':id/workstations/:wsId/report-andon')
    async reportAndon(
        @Param('id', ParseIntPipe) sessionId: number,
        @Param('wsId') wsId: string,
        @Body() reportAndonDto: ReportAndonDto,
    ) {
        return this.sessionsService.reportAndon(sessionId, wsId, reportAndonDto.message);
    }

    @Post(':id/andon-alerts/:andonId/resolve')
    async resolveAndonAlert(
        @Param('id', ParseIntPipe) sessionId: number, // Keep for consistent routing, though unused
        @Param('andonId', ParseIntPipe) andonId: number,
    ) {
        return this.sessionsService.resolveAndonAlert(andonId);
    }
}
