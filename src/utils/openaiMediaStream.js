import { CallSession } from '../models/sessionData.js';
import { BaseMediaStreamHandler } from '../services/baseMediaStreamHandler.js';
import WebSocket from 'ws';
export class OpenAIMediaStreamHandler extends BaseMediaStreamHandler {
    constructor(config) {
        super(config);
        this.openAiWs = null;
        this.callSessionId = config.callSessionId;
        this.VOICE = config.voice || 'echo';
        this.SYSTEM_MESSAGE = config.systemMessage || 'You are a helpful assistant.';
        this.OPEN_API_KEY = config.apiKey;
        this.MODEL = config.model || 'gpt-4o-realtime-preview-2024-10-01';
        this.streamSid = config.streamSid;
        this.broadcastToWebClients = null;
        this.connected = false;
        this.isAssistantSpeaking = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.lastInterruptionTime = 0;
        this.interruptCooldownMs = 1000; // 1 second cooldown
        this.inactivityTimeout = null;
        this.inactivityDurationMs = 5000; // 5 seconds
    }
    startInactivityTimer() {
        if (this.inactivityTimeout) clearTimeout(this.inactivityTimeout);

        this.inactivityTimeout = setTimeout(() => {
            console.log(`[${this.callSessionId}] Ending call due to inactivity.`);
            this.broadcastToWebClients({ type: 'callStatus', text: "inactive" });
            this.broadcastToWebClients({ type: 'clientDisconnected', text: "Call ended due to inactivity", sessionId: this.callSessionId });

            this.disconnect(); // Close OpenAI socket
            if (this.connection && this.connection.readyState === WebSocket.OPEN) {
                this.connection.close(); // Close Twilio socket
            }

            CallSession.findByIdAndUpdate(this.callSessionId, {
                status: 'completed',
                endTime: new Date(),
                reasonEnded: 'inactivity'
            }).catch(console.error);
        }, this.inactivityDurationMs);
    }

    async connect(connection) {
        this.connection = connection;
        this.openAiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=${this.MODEL}`, { headers: { Authorization: `Bearer ${this.OPEN_API_KEY}`, "OpenAI-Beta": "realtime=v1" } });
        this.openAiWs.on('open', () => {
            console.log(`[${this.callSessionId}] Connected to OpenAI Realtime API`);
            this.connected = true;
            this.reconnectAttempts = 0;
            // Send initial session setup after a short delay to ensure connection stability
            setTimeout(() => this.sendInitialSessionUpdate(), 250);
        });
        this.openAiWs.on('message', (data) => this.handleOpenAIMessage(data));
        this.openAiWs.on('close', (code, reason) => {
            console.log(`[${this.callSessionId}] Disconnected from OpenAI Realtime API:`, code, reason?.toString());
            this.connected = false;
            // Attempt reconnection if unexpected closure
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.attemptReconnect();
            }
        });
        this.openAiWs.on('error', (error) => {
            console.error(`[${this.callSessionId}] Error in OpenAI WebSocket:`, error);
            if (this.broadcastToWebClients) this.broadcastToWebClients({ type: 'error', message: 'Error connecting to AI service' });
        });
    }
    async attemptReconnect() {
        this.reconnectAttempts++;
        console.log(`[${this.callSessionId}] Attempting to reconnect to OpenAI (attempt ${this.reconnectAttempts})`);

        try {
            await this.connect(this.connection);
        } catch (error) {
            console.error(`[${this.callSessionId}] Reconnection attempt failed:`, error);
        }
    }
    sendInitialSessionUpdate() {
        const sessionUpdate = {
            type: 'session.update',
            session: {
                turn_detection: {
                    type: 'server_vad',
                    interrupt_response: true,
                    threshold: 0.8,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 1000,
                },
                input_audio_format: 'g711_ulaw',
                output_audio_format: 'g711_ulaw',
                voice: this.VOICE,
                instructions: this.SYSTEM_MESSAGE,
                modalities: ["text", "audio"],
                temperature: 0.8,
                input_audio_transcription: { model: "whisper-1" }
            }
        };
        this.openAiWs.send(JSON.stringify(sessionUpdate));
        const initialConversationItem = {
            type: 'conversation.item.create',
            item: {
                type: 'message',
                role: 'user',
                content: [
                    {
                        type: 'input_text',
                        text: 'Greet the user with "Hello this is AVA, how can I help you?"'
                    }
                ]
            }
        };
        this.openAiWs.send(JSON.stringify(initialConversationItem));
        this.openAiWs.send(JSON.stringify({ type: 'response.create' }));
    }
    sendClearToTwilio() {
        if (this.streamSid && this.connection?.readyState === WebSocket.OPEN) {
            const clearMessage = {
                event: "clear",
                streamSid: this.streamSid
            };
            this.connection.send(JSON.stringify(clearMessage));
            console.log(`[${this.callSessionId}] Sent 'clear' message to Twilio for streamSid ${this.streamSid}`);
        }
    }
    handleOpenAIMessage(data) {
        try {
            const response = JSON.parse(data);
            switch (response.type) {
                case 'conversation.item.input_audio_transcription.completed':
                    if (response.transcript.trim()) {
                        CallSession.findOneAndUpdate({ callSessionId: this.callSessionId }, { $push: { transcripts: { speaker: "user", message: response.transcript } } }).catch((error) => {
                            console.error('Error saving user transcript:', error);
                        });
                        this.broadcastToWebClients({ type: 'user_transcript', text: response.transcript });
                    }
                    break;
                case 'response.audio_transcript.done':
                    if (response.transcript.trim()) {
                        CallSession.findOneAndUpdate({ callSessionId: this.callSessionId }, { $push: { transcripts: { speaker: "assistant", message: response.transcript } } }).catch((error) => {
                            console.error('Error saving assistant transcript:', error);
                        });
                        this.broadcastToWebClients({ type: 'ava_response', text: response.transcript });
                    }
                    break;
                case 'response.audio.delta':
                    this.isAssistantSpeaking = true;
                    if (response.delta) {
                        const audioDelta = {
                            event: 'media',
                            streamSid: this.streamSid,
                            media: {
                                payload: Buffer.from(response.delta, 'base64').toString('base64')
                            }
                        };
                        this.connection.send(JSON.stringify(audioDelta));
                    }
                    break;
                case 'session.updated':
                    // console.log('Session updated');
                    break;
                case 'input_audio.vad':
                    if (response.status === 'speech_start') {
                        this.startInactivityTimer();
                        const now = Date.now();
                        if (this.isAssistantSpeaking && now - this.lastInterruptionTime > this.interruptCooldownMs) {
                            console.log('User started speaking - interrupting model');
                            this.openAiWs.send(JSON.stringify({ type: 'response.stop' }));
                            this.sendClearToTwilio();
                            this.lastInterruptionTime = now;
                        } else {
                            console.log('Speech_start ignored due to cooldown or model not speaking');
                        }
                    }
                    break;
                case 'response.interrupted':
                    this.isAssistantSpeaking = false;
                    // console.log('Response was interrupted by user');
                    break;
                case 'response.completed':
                    this.isAssistantSpeaking = false;
                    console.log('Response completed');
                    this.broadcastToWebClients(JSON.stringify({ type: 'ava_done' }))
                    break;
                default:
                    // console.log(`event type ${response.type}`);
                    break;
            }
        } catch (error) {
            console.error('Error processing OpenAI message:', error, 'Raw message:', data);
        }
    }

    handleIncomingMessage(message) {
        try {
            const data = JSON.parse(message);
            switch (data.event) {
                case 'media':
                    if (this.openAiWs.readyState === WebSocket.OPEN) this.openAiWs.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: data.media.payload }));
                    this.startInactivityTimer();
                    break;
                case 'start':
                    this.streamSid = data.start.streamSid;
                    CallSession.findByIdAndUpdate(
                        this.callSessionId,
                        {
                            startTime: new Date(),
                            status: 'active',
                            twilioStreamSid: this.streamSid
                        })
                    console.log('user attended the call', this.streamSid);
                    break;
                case 'stop':
                    console.log('user disconnected the call');
                    this.disconnect('user_disconnect');
                    break;
                default:
                    console.log('Received non-media event:', data.event);
                    break;
            }

        } catch (error) {
            console.error('Error parsing message:', error, 'Message:', message);
        }
    }
    disconnect(reason) {
        if (this.openAiWs?.readyState === WebSocket.OPEN) this.openAiWs.close();
        if (this.inactivityTimeout) {
            clearTimeout(this.inactivityTimeout);
            this.inactivityTimeout = null;
        }
        // Send 'stop' event to Twilio to explicitly end the call
        if (this.connection?.readyState === WebSocket.OPEN && this.streamSid) {
            const stopMessage = {
                event: 'stop',
                streamSid: this.streamSid
            };
            this.connection.send(JSON.stringify(stopMessage));
            console.log(`[${this.callSessionId}] Sent stop signal to Twilio.`);
        }
        this.reconnectAttempts = this.maxReconnectAttempts
        this.connected = false;
        CallSession.findByIdAndUpdate(this.callSessionId, {
            status: 'completed',
            endTime: new Date(),
            reasonEnded: reason || 'user_disconnect'
        }).catch(error => console.error(error));
        console.log(`[${this.callSessionId}] Client disconnected.`);
        if (this.broadcastToWebClients) {
            this.broadcastToWebClients({ type: 'callStatus', text: "inactive" });
            this.broadcastToWebClients({ type: 'clientDisconnected', text: "Call ended", sessionId: this.callSessionId });
        }
    }
}
