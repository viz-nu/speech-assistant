import WebSocket from "ws";
import { BaseMediaStreamHandler } from "./baseMediaStreamHandler.js";

export class DeepgramMediaStreamHandler extends BaseMediaStreamHandler {
    constructor(config) {
        super(config);
        this.deepgramWs = null;
        this.DEEPGRAM_API_KEY = config.apiKey;
        this.VOICE_AGENT_ID = config.voiceAgentId; // Deepgram Voice AI Agent ID
    }

    async connect(connection) {
        this.connection = connection;
        
        // Connect to Deepgram Voice AI
        this.deepgramWs = new WebSocket(`wss://api.deepgram.com/v1/agent/${this.VOICE_AGENT_ID}/realtime`, {
            headers: {
                Authorization: `Token ${this.DEEPGRAM_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        this.deepgramWs.on('open', () => {
            console.log('Connected to Deepgram Voice AI');
            this.sendInitialConfiguration();
        });

        this.deepgramWs.on('message', (data) => this.handleDeepgramMessage(data));
        this.deepgramWs.on('close', () => console.log('Disconnected from Deepgram Voice AI'));
        this.deepgramWs.on('error', (error) => console.error('Error in Deepgram WebSocket:', error));
    }

    sendInitialConfiguration() {
        const config = {
            type: 'Configure',
            config: {
                encoding: 'mulaw',
                sample_rate: 8000,
                channels: 1,
                endpointing: {
                    mode: 'vad',
                    vad_threshold_ms: 1000
                },
                interim_results: true,
                utterance_end_ms: 1000,
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.5
                }
            }
        };
        
        this.deepgramWs.send(JSON.stringify(config));
        
        // Send initial greeting
        this.broadcastToWebClients({ 
            type: 'ava_response', 
            text: "Hello this is AVA, I am here you help you with your abroad education journey" 
        });
        
        // Initialize the conversation
        this.deepgramWs.send(JSON.stringify({
            type: 'Start',
            start: {
                initial_prompt: "Hello this is AVA, I am here you help you with your abroad education journey"
            }
        }));
    }

    handleDeepgramMessage(data) {
        try {
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'Transcript':
                    if (message.transcript && message.transcript.trim()) {
                        console.log('USER SAID:', message.transcript);
                        this.broadcastToWebClients({ 
                            type: 'user_transcript', 
                            text: message.transcript 
                        });
                    }
                    break;
                    
                case 'Response':
                    if (message.text) {
                        console.log('AVA RESPONSE:', message.text);
                        this.broadcastToWebClients({ 
                            type: 'ava_response', 
                            text: message.text 
                        });
                    }
                    break;
                    
                case 'Audio':
                    if (message.audio) {
                        const audioData = {
                            event: 'media',
                            streamSid: this.streamSid,
                            media: {
                                payload: message.audio
                            }
                        };
                        this.connection.send(JSON.stringify(audioData));
                    }
                    break;
                    
                case 'ResponseComplete':
                    console.log('Response completed');
                    this.broadcastToWebClients({ type: 'ava_done' });
                    break;
                    
                case 'Interruption':
                    console.log('Response was interrupted by user');
                    break;
                    
                default:
                    console.log(`Received event type: ${message.type}`);
                    break;
            }
        } catch (error) {
            console.error('Error processing Deepgram message:', error, 'Raw message:', data);
        }
    }

    async handleIncomingMessage(message) {
        try {
            const data = JSON.parse(message);
            
            switch (data.event) {
                case 'media':
                    if (this.deepgramWs.readyState === WebSocket.OPEN) {
                        // Send audio to Deepgram
                        this.deepgramWs.send(JSON.stringify({
                            type: 'Audio',
                            audio: data.media.payload
                        }));
                    }
                    break;
                    
                case 'start':
                    this.streamSid = data.start.streamSid;
                    console.log('Incoming stream has started', this.streamSid);
                    break;
                    
                default:
                    console.log('Received non-media event:', data.event);
                    break;
            }
        } catch (error) {
            console.error('Error parsing message:', error, 'Message:', message);
        }
    }

    async disconnect() {
        if (this.deepgramWs && this.deepgramWs.readyState === WebSocket.OPEN) {
            this.deepgramWs.close();
        }
        console.log('Client disconnected.');
    }
}