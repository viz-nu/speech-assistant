import { CallSession } from '../models/sessionData.js';
import { BaseMediaStreamHandler } from '../services/baseMediaStreamHandler.js';
import WebSocket from 'ws';

/**
 * OpenAI MediaStream Handler
 * Manages real-time audio communication between Twilio and OpenAI Realtime API
 * 
 * Event Flow:
 * INCOMING (Client -> Server):
 * - Twilio WebSocket events (media, start, stop)
 * - Audio data from user
 * 
 * OUTGOING (Server -> Client):
 * - OpenAI WebSocket events to AI service
 * - Audio responses back to Twilio
 * - Status updates to web clients
 */
export class OpenAIMediaStreamHandler extends BaseMediaStreamHandler {
    constructor(config) {
        super(config);

        // Connection instances
        this.openAiWs = null;
        this.connection = null; // Twilio WebSocket connection

        // Configuration
        this.callSessionId = config.callSessionId;
        this.streamSid = config.streamSid;
        this.VOICE = config.voice || 'echo';
        this.SYSTEM_MESSAGE = config.systemMessage || 'You are a helpful assistant.';
        this.OPEN_API_KEY = config.apiKey;
        this.MODEL = config.model || 'gpt-4o-realtime-preview-2024-10-01';

        // State management
        this.connected = false;
        this.isAssistantSpeaking = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;

        // Interruption handling
        this.lastInterruptionTime = 0;
        this.interruptCooldownMs = 1000; // 1 second cooldown

        // Inactivity management
        this.inactivityTimeout = null;
        this.inactivityDurationMs = 5000; // 5 seconds

        // External broadcast function
        this.broadcastToWebClients = null;
    }
    /**
     * Handle audio delta from OpenAI
     */
    _handleAudioDelta(response) {
        this.isAssistantSpeaking = true;

        if (response.delta && this._isTwilioConnected()) {
            this._sendAudioToTwilio(response.delta);
        }
    }

    /**
     * Handle speech start detection
     */
    _handleSpeechStart() {
        this._resetInactivityTimer();

        const now = Date.now();
        const canInterrupt = this.isAssistantSpeaking &&
            (now - this.lastInterruptionTime > this.interruptCooldownMs);

        if (canInterrupt) {
            console.log(`[${this.callSessionId}] User interrupted - stopping model response`);
            this._interruptOpenAIResponse();
            this._clearTwilioAudio();
            this.lastInterruptionTime = now;
        }
    }

    // ============================================
    // OUTGOING EVENTS TO TWILIO
    // ============================================

    /**
     * Send audio data to Twilio
     */
    _sendAudioToTwilio(audioBase64) {
        if (!this._isTwilioConnected()) return;

        const audioDelta = {
            event: 'media',
            streamSid: this.streamSid,
            media: {
                payload: Buffer.from(audioBase64, 'base64').toString('base64')
            }
        };

        this._sendToTwilio(audioDelta);
    }

    /**
     * Clear audio buffer in Twilio
     */
    _clearTwilioAudio() {
        if (!this._isTwilioConnected()) return;

        this._sendToTwilio({
            event: 'clear',
            streamSid: this.streamSid
        });

        console.log(`[${this.callSessionId}] Sent 'clear' message to Twilio for streamSid ${this.streamSid}`);
    }

    /**
     * Send stop signal to Twilio
     */
    _stopTwilioStream() {
        if (!this._isTwilioConnected()) return;

        this._sendToTwilio({
            event: 'stop',
            streamSid: this.streamSid
        });

        console.log(`[${this.callSessionId}] Sent stop signal to Twilio`);
    }

    /**
     * Generic method to send data to Twilio
     */
    _sendToTwilio(data) {
        if (!this._isTwilioConnected()) {
            console.warn(`[${this.callSessionId}] Cannot send to Twilio - connection not ready`);
            return;
        }

        try {
            this.connection.send(JSON.stringify(data));
        } catch (error) {
            console.error(`[${this.callSessionId}] Error sending to Twilio:`, error);
        }
    }

    // ============================================
    // INCOMING EVENTS FROM TWILIO
    // ============================================

    /**
     * Handle incoming messages from Twilio WebSocket
     */
    handleIncomingMessage(message) {
        try {
            const data = JSON.parse(message);

            switch (data.event) {
                case 'media':
                    this._handleTwilioMedia(data);
                    break;

                case 'start':
                    this._handleTwilioStart(data);
                    break;

                case 'stop':
                    this._handleTwilioStop();
                    break;

                default:
                    console.log(`[${this.callSessionId}] Unhandled Twilio event: ${data.event}`);
                    break;
            }
        } catch (error) {
            console.error(`[${this.callSessionId}] Error parsing Twilio message:`, error, 'Message:', message);
        }
    }

    /**
     * Handle media data from Twilio
     */
    _handleTwilioMedia(data) {
        this._sendAudioToOpenAI(data.media.payload);
        this._resetInactivityTimer();
    }

    /**
     * Handle call start from Twilio
     */
    _handleTwilioStart(data) {
        this.streamSid = data.start.streamSid;

        this._updateCallSession({
            startTime: new Date(),
            status: 'active',
            streamSid: this.streamSid
        });

        console.log(`[${this.callSessionId}] User attended the call - StreamSid: ${this.streamSid}`);
    }

    /**
     * Handle call stop from Twilio
     */
    _handleTwilioStop() {
        console.log(`[${this.callSessionId}] User disconnected the call`);
        this._endCall('user_disconnect');
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    /**
     * Check if OpenAI WebSocket is connected
     */
    _isOpenAIConnected() {
        return this.openAiWs?.readyState === WebSocket.OPEN;
    }

    /**
     * Check if Twilio WebSocket is connected
     */
    _isTwilioConnected() {
        return this.connection?.readyState === WebSocket.OPEN && this.streamSid;
    }

    /**
     * Save transcript to database
     */
    async _saveTranscript(speaker, message) {
        try {
            await CallSession.findOneAndUpdate(
                { callSessionId: this.callSessionId },
                { $push: { transcripts: { speaker, message } } }
            );
        } catch (error) {
            console.error(`[${this.callSessionId}] Error saving ${speaker} transcript:`, error);
        }
    }

    /**
     * Update call session in database
     */
    async _updateCallSession(updates) {
        try {
            await CallSession.findByIdAndUpdate(this.callSessionId, updates);
        } catch (error) {
            console.error(`[${this.callSessionId}] Error updating call session:`, error);
        }
    }

    /**
     * Broadcast message to web clients
     */
    _broadcastToWebClients(message) {
        if (this.broadcastToWebClients) {
            this.broadcastToWebClients(message);
        }
    }

    /**
     * Broadcast error to web clients
     */
    _broadcastError(message) {
        this._broadcastToWebClients({
            type: 'error',
            message
        });
    }

    /**
     * End call and cleanup resources
     */
    async _endCall(reason) {
        this._clearInactivityTimer();

        // Close OpenAI connection
        if (this._isOpenAIConnected()) {
            this.openAiWs.close();
        }

        // Close Twilio connection
        this._stopTwilioStream();
        if (this._isTwilioConnected()) {
            this.connection.close();
        }

        // Update database
        await this._updateCallSession({
            status: 'completed',
            endTime: new Date(),
            reasonEnded: reason
        });

        console.log(`[${this.callSessionId}] Call ended - Reason: ${reason}`);
    }

    // ============================================
    // PUBLIC INTERFACE
    // ============================================

    /**
     * Disconnect and cleanup all resources
     */
    disconnect() {
        this._endCall('manual_disconnect');
    }

    /**
     * Set broadcast function for web client communication
     */
    setBroadcastFunction(broadcastFn) {
        this.broadcastToWebClients = broadcastFn;
    }

    /**
     * Get current connection status
     */
    getStatus() {
        return {
            connected: this.connected,
            isAssistantSpeaking: this.isAssistantSpeaking,
            streamSid: this.streamSid,
            reconnectAttempts: this.reconnectAttempts
        };
    }
}

// ...incomplete


initiateConnectionBetweenUserAndPro