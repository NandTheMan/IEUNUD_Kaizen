import { Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Post, Res } from '@nestjs/common';
import { Response } from 'express';
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

    @Get('sessions/:sessionId/workstations/:wsId/pull-signal-status')
    getPullSignalStatus(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Param('wsId') wsId: string,
    ) {
    return this.sessionsService.getPullSignalStatus(sessionId, wsId);
    }

    @Get(':id/kanban-board')
    async getKanbanBoard(@Param('id', ParseIntPipe) id: number) {
        return this.sessionsService.getKanbanBoardState(id);
    }

    @Get(':id/warehouse-stock')
    async getWarehouseStockState(@Param('id', ParseIntPipe) id: number) {
        return this.sessionsService.getWarehouseStockState(id);
    }

    @Get(':id/low-stock-alerts')
    async getLowStockAlerts(@Param('id', ParseIntPipe) id: number) {
        return this.sessionsService.getLowStockAlerts(id);
    }

    @Get(':id/andon-alerts')
    async getAndonAlerts(@Param('id', ParseIntPipe) id: number) {
        return this.sessionsService.getAndonAlerts(id);
    }

    @Get(':id/summary')
    async getSessionSummary(@Param('id', ParseIntPipe) id: number) {
        return this.sessionsService.getSessionSummary(id);
    }

    @Get(':id/oee')
    getOee(@Param('id', ParseIntPipe) id: number) {
    return this.sessionsService.getOEEMetrics(id);
    }

    @Get(':id/cycles')
    getCycles(@Param('id', ParseIntPipe) id: number) {
    return this.sessionsService.getCycleLog(id);
    }

    @Get(':id/export')
    async exportSessionSummary(
        @Param('id', ParseIntPipe) id: number,
        @Res() res: Response,
    ) {
        // 1. Set the headers to trigger a file download in the browser
        res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader(
        'Content-Disposition',
        `attachment; filename=Laporan_TPS_Sesi_${id}.xlsx`,
        );

        // 2. Stream the Excel file directly to the response
        await this.sessionsService.generateExcelReport(id, res);
    }

    @Get(':id/workstations/:wsId/stock')
    async getWorkstationStock(
        @Param('id', ParseIntPipe) sessionId: number,
        @Param('wsId') wsId: string,
    ) {
        return this.sessionsService.getWorkstationStock(sessionId, wsId);
    }

    @Get(':id/workstations/:wsId/status')
    async getWorkstationStatus(
    @Param('id', ParseIntPipe) sessionId: number,
    @Param('wsId') wsId: string,
    ) {
    return this.sessionsService.getWorkstationStatus(sessionId, wsId);
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

    @Post(':id/logistik/:logId/fulfill')
    async fulfillLogisticsRequest(
      @Param('id', ParseIntPipe) sessionId: number,
      @Param('logId', ParseIntPipe) logId: number,
    ) {
      return this.sessionsService.fulfillLogisticsRequest(sessionId, logId);
    }

    // ─── Buzzer Endpoints ────────────────────────────────────────────────────────

    /**
     * GET /sessions/:id/buzzer
     * Returns the current buzzer state for a session.
     */
    @Get(':id/buzzer')
    getBuzzerState(@Param('id', ParseIntPipe) id: number) {
        return this.sessionsService.getBuzzerState(id);
    }

    /**
     * POST /sessions/:id/buzzer/start
     * Manually starts Buzzer 1 for a session (normally auto-triggered by submitOrder).
     */
    @Post(':id/buzzer/start')
    startBuzzer(@Param('id', ParseIntPipe) id: number) {
        return this.sessionsService.startBuzzer(id);
    }

    /**
     * POST /sessions/:id/buzzer/pause
     * Pauses the active buzzer timer.
     */
    @Post(':id/buzzer/pause')
    pauseBuzzer(@Param('id', ParseIntPipe) id: number) {
        return this.sessionsService.pauseBuzzer(id);
    }

    /**
     * POST /sessions/:id/buzzer/resume
     * Resumes a paused buzzer timer.
     */
    @Post(':id/buzzer/resume')
    resumeBuzzer(@Param('id', ParseIntPipe) id: number) {
        return this.sessionsService.resumeBuzzer(id);
    }

    /**
     * POST /sessions/:id/buzzer/reset
     * Resets the buzzer back to Buzzer 0 (Initialized).
     */
    @Post(':id/buzzer/reset')
    resetBuzzer(@Param('id', ParseIntPipe) id: number) {
        return this.sessionsService.resetBuzzer(id);
    }
}
