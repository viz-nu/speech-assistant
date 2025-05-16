import { BaseMediaStreamHandler } from '../services/baseMediaStreamHandler.js';
import WebSocket from 'ws';
import { analyzeConversation } from './openAi.js';
const conversation = []
export class OpenAIMediaStreamHandler extends BaseMediaStreamHandler {
    constructor(config) {
        super(config);
        this.openAiWs = null;
        this.VOICE = config.voice || 'echo';
        this.SYSTEM_MESSAGE = config.systemMessage || 'You are a helpful assistant.';
        this.OPEN_API_KEY = config.apiKey;
        this.MODEL = config.model || 'gpt-4o-realtime-preview-2024-10-01';
    }
    async connect(connection) {
        this.connection = connection;
        this.openAiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=${this.MODEL}`, { headers: { Authorization: `Bearer ${this.OPEN_API_KEY}`, "OpenAI-Beta": "realtime=v1" } });
        this.openAiWs.on('open', () => {
            console.log('Connected to the OpenAI Realtime API');
            setTimeout(() => this.sendInitialSessionUpdate(), 250); // Ensure connection stability, send after .250 second
        });
        this.openAiWs.on('message', async (data) => await this.handleOpenAIMessage(data));
        this.openAiWs.on('close', () => console.log('Disconnected from the OpenAI Realtime API'));
        this.openAiWs.on('error', (error) => console.error('Error in the OpenAI WebSocket:', error));
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
        console.log('Sending session update:', JSON.stringify(sessionUpdate));
        this.openAiWs.send(JSON.stringify(sessionUpdate));
        const initialConversationItem = {
            type: 'conversation.item.create',
            item: {
                type: 'message',
                role: 'user',
                content: [
                    {
                        type: 'input_text',
                        text: 'Greet the user with "Hello this is AVA, I am here you help you with your abroad education journey"'
                    }
                ]
            }
        };
        this.openAiWs.send(JSON.stringify(initialConversationItem));
        this.openAiWs.send(JSON.stringify({ type: 'response.create' }));
    }

    async handleOpenAIMessage(data) {
        try {
            const response = JSON.parse(data);
            switch (response.type) {
                case 'conversation.item.input_audio_transcription.completed':
                    if (response.transcript.trim()) {
                        console.log('USER SAID (complete):');
                        console.dir(response.transcript);
                        conversation.push({ role: 'user', content: response.transcript })
                        this.broadcastToWebClients({ type: 'user_transcript', text: response.transcript });
                    }
                    break;

                case 'response.audio_transcript.done':
                    if (response.transcript.trim()) {
                        console.log('AUDIO TRANSCRIPT (complete):');
                        console.dir(response.transcript);
                        conversation.push({ role: 'assistant', content: response.transcript })
                        this.broadcastToWebClients({ type: 'ava_response', text: response.transcript });
                    }
                    break;

                case 'response.audio.delta':
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
                    console.log('Session updated');
                    break;

                case 'input_audio.vad':
                    if (response.status === 'speech_start') {
                        console.log('User started speaking - interrupting model');
                        this.openAiWs.send(JSON.stringify({ type: 'response.stop' }));
                    }
                    break;

                case 'response.interrupted':
                    console.log('Response was interrupted by user');
                    break;

                case 'response.completed':
                    console.log('Response completed');
                    const summary = await analyzeConversation(conversation, this.OPEN_API_KEY)
                    this.broadcastToWebClients(JSON.stringify({ type: 'ava_done', data: summary }))
                    break;

                default:
                    console.log(`event type ${response.type}`);
                    break;
            }
        } catch (error) {
            console.error('Error processing OpenAI message:', error, 'Raw message:', data);
        }
    }

    async handleIncomingMessage(message) {
        try {
            const data = JSON.parse(message);
            switch (data.event) {
                case 'media':
                    if (this.openAiWs.readyState === WebSocket.OPEN) {
                        const audioAppend = {
                            type: 'input_audio_buffer.append',
                            audio: data.media.payload
                        };
                        this.openAiWs.send(JSON.stringify(audioAppend));
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
        if (this.openAiWs && this.openAiWs.readyState === WebSocket.OPEN) {
            this.openAiWs.close();
        }
        console.log('Client disconnected.');
    }
}
