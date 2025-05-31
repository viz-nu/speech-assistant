// Function to broadcast to web clients
export const webClients = new Set();
export const broadcastToWebClients = (payload) => {
  const message = JSON.stringify(payload);
  for (const client of webClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
};
// Configuration
import { configDotenv } from 'dotenv';
import { initiateConnectionBetweenUserAndProvider } from './mediaStreamHandlerFactory.js';
import { CallSession } from '../models/sessionData.js';
configDotenv();

export function setupWebSocketRoutes(fastify) {
  fastify.register(async (fastify) => {
    // Setup WebSocket server for handling media streams
    fastify.get('/media-stream', { websocket: true }, async (connection, req) => {
      let sessionId, handler, activeSession = false;
      try {
        console.log("connection:", JSON.stringify(connection, null, 2));
        connection.on('message', async (message) => {
          try {
            const parsed = JSON.parse(message);
            console.log("parsed message (check for event):", JSON.stringify(parsed, null, 2));
            if (parsed.event === 'start' && !activeSession) {
              sessionId = parsed.start.customParameters?.sessionId;
              if (!sessionId) {
                console.error('No session ID provided in connection metadata');
                connection.close();
                return;
              }
              try {
                const { status, message, mediaHandler } = await initiateConnectionBetweenUserAndProvider({ sessionId, connection })
                if (!status) {
                  console.error(message);
                  connection.close();
                  return;
                }
                handler = mediaHandler;
                handler.setBroadcastFunction(broadcastToWebClients);
                await handler.connect(connection);
                activeSession = true;
                handler.broadcastToWebClients({ type: 'callStatus', text: "active" });
                // Now that we're set up, handle the current message
                handler.handleIncomingMessage(message);
              } catch (err) {
                console.error(`Error setting up session ${sessionId}:`, err);
                connection.close();
              }
            } else if (activeSession && handler) {
              // Regular message handling after setup is complete
              handler.handleIncomingMessage(message);
            }
          } catch (err) {
            console.error('Error processing WebSocket message:', err, 'Raw message:', message);
          }
        });
        // Step 6: Handle disconnections
        connection.on('close', async () => {
          console.log(`WebSocket connection closed for session ${sessionId}`);
          if (handler) {
            handler.disconnect();
            handler.broadcastToWebClients({ type: 'callStatus', text: "inactive" });
            handler.broadcastToWebClients({ type: 'clientDisconnected', text: "Call ended", sessionId: sessionId });
          }
          // Update session status in database
          if (sessionId) {
            await CallSession.findByIdAndUpdate(sessionId, {
              status: 'completed',
              endTime: new Date()
            });
          }
        });
      } catch (error) {
        console.error(`Error setting up ${PROVIDER} handler:`, error);
        connection.close();
        handler.broadcastToWebClients({ type: 'callStatus', status: "inactive" });
        handler.broadcastToWebClients({ type: 'clientDisconnected', text: "Call ended", sessionId: sessionId });
        return;
      }
    });

    // ✅ New client WebSocket route
    fastify.get('/ws/client', { websocket: true }, (clientSocket, req) => {
      console.log('Client UI connected');
      webClients.add(clientSocket);
      const pingInterval = setInterval(() => {
        if (clientSocket.readyState === clientSocket.OPEN) {
          clientSocket.ping(); // This keeps the connection alive
        }
      }, 30000); // every 30s
      clientSocket.on('close', () => {
        clearInterval(pingInterval);
        webClients.delete(clientSocket);
        console.log('Client UI disconnected');
        return;
      });
      clientSocket.on('error', (error) => {
        clearInterval(pingInterval);
        console.error('Client UI error:', error);
        webClients.delete(clientSocket);
        return;
      });
    });
  });
}