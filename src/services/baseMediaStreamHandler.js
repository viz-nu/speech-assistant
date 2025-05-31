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

export class TelephonyAdapter {
    constructor(connection, sessionId) {
        this.connection = connection;
        this.callSessionId = sessionId;
        this.streamSid = null;
    }

    // Incoming messages
    handleIncomingMessage(message) {
        throw new Error('Not implemented');
    }

    // Outgoing
    sendMedia(base64Audio) {
        throw new Error('Not implemented');
    }

    sendMark(mark) {
        throw new Error('Not implemented');
    }

    sendClear() {
        throw new Error('Not implemented');
    }

    sendStop() {
        throw new Error('Not implemented');
    }

    _send(data) {
        try {
            this.connection.send(JSON.stringify(data));
        } catch (err) {
            console.error(`[${this.callSessionId}] Send error:`, err);
        }
    }

    isConnected() {
        return this.connection && this.connection.readyState === this.connection.OPEN;
    }
}