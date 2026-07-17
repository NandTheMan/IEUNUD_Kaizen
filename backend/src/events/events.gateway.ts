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
    origin: '*', // In production, you should restrict this to your frontend URL
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`[WebSocket] Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[WebSocket] Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_workstation_room')
  handleJoinRoom(client: Socket, wsId: string) {
    const roomName = `ws-${wsId}`;
    client.join(roomName);
    console.log(`[WebSocket] Client ${client.id} joined room: ${roomName}`);
  }

  @SubscribeMessage('leave_workstation_room')
  handleLeaveRoom(client: Socket, wsId: string) {
    const roomName = `ws-${wsId}`;
    client.leave(roomName);
    console.log(`[WebSocket] Client ${client.id} left room: ${roomName}`);
  }

  broadcastKanbanUpdate() {
    this.server.emit('kanban_updated');
  }

  notifyWorkstation(wsId: string, payload: { title: string; message: string }) {
    this.server.to(`ws-${wsId}`).emit('WORKSTATION_NOTIFICATION', payload);
  }

  broadcastAndonUpdate() {
    this.server.emit('andon_updated');
  }
}
