// baseMediaStreamHandler.js
export class BaseMediaStreamHandler {
    constructor(config) {
        this.config = config;
        this.streamSid = null;
    }

    async connect(connection) {
        throw new Error('connect method must be implemented by subclass');
    }

    async handleIncomingMessage(message) {
        throw new Error('handleIncomingMessage method must be implemented by subclass');
    }

    async disconnect() {
        throw new Error('disconnect method must be implemented by subclass');
    }

    // Common utility methods
    broadcastToWebClients(message) {
        if (this.broadcastToWebClients) this.broadcastToWebClients(message);
    }

    setBroadcastFunction(broadcastToWebClients) {
        this.broadcastToWebClients = broadcastToWebClients;
    }
}