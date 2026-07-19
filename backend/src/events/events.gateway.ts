import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*', // Allow all origins for simplicity in development
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket, ...args: any[]) {
    // console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    // console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_workstation_room')
  handleJoinWorkstationRoom(client: Socket, wsId: string) {
    client.join(wsId);
    // console.log(`Client ${client.id} joined room ${wsId}`);
  }

  @SubscribeMessage('leave_workstation_room')
  handleLeaveWorkstationRoom(client: Socket, wsId: string) {
    client.leave(wsId);
    // console.log(`Client ${client.id} left room ${wsId}`);
  }

  /**
   * Sends a notification to a specific workstation room.
   * Used for pull signals.
   */
  notifyWorkstation(wsId: string, data: { title: string; message: string }) {
    this.server.to(wsId).emit('WORKSTATION_NOTIFICATION', data);
  }

  /**
   * Broadcasts a state update to a specific workstation room.
   * This tells the workstation's display to refresh its data.
   * @param wsId The ID of the workstation room to broadcast to.
   */
  broadcastWorkstationStateUpdate(wsId: string) {
    this.server.to(wsId).emit('workstation_state_updated');
  }

  /**
   * Broadcasts a generic update to all clients that the kanban state has changed.
   * This is the primary trigger for most UI refreshes.
   */
  broadcastKanbanUpdate() {
    this.server.emit('kanban_updated');
  }

  /**
   * Broadcasts that the Andon alert list has been updated.
   */
  broadcastAndonUpdate() {
    this.server.emit('andon_updated');
  }

  /**
   * Broadcasts that the logistics request list (low stock alerts) has been updated.
   */
  broadcastLowStockUpdate() {
    this.server.emit('logistikUpdate');
  }
}
