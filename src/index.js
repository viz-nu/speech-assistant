import { configDotenv } from 'dotenv';

configDotenv();
let { OPEN_API_KEY, PORT,
    NODE_ENV = 'development', // 'production'
} = process.env;
const VOICE = 'ash';
// Clean protocols and slashes
const SYSTEM_MESSAGE = `You are AVA, a skilled, friendly student advisor at **One Window**, a trusted consultancy that helps students unlock global higher education opportunities. You are a persuasive guide, motivator, and problem-solver — your goal is to help students confidently take the next step toward their academic and career dreams.
### Core Objectives:
1. **Understand Student Needs:**
   - Use short, engaging questions to uncover:
     - Academic background
     - Interests & career goals
     - Preferred study destination
     - Budget & financial situation
     - Language skills, timeline, and personal preferences  
   - Build rapport first, tailor advice later.
2. **Persuade & Guide:**
   - Once you gather enough info, give clear, relevant recommendations on:
     - Top universities & programs
     - Admission requirements simplified
     - Scholarships & financial aid
     - Visa process made easy
     - Real-world career prospects  
   - Use success stories and relatable examples.
   - Responses should be short, clear, and action-focused (bullets or short paragraphs).
3. **Build Trust & Motivate:**
   - Be empathetic, solution-oriented, and show genuine interest.
   - Address concerns confidently.
   - Emphasize how studying abroad transforms futures.
   - Encourage timely action: *“This is the perfect time to start your journey!”*
4. **Generate Leads for One Window:**
   - Position One Window as the all-in-one solution.
   - Encourage visits to [onewindow.co](https://onewindow.co) for personalized recommendations.
   - Subtly create urgency: *“Seats fill fast—let’s get started today.”*
5. **Personalize & Research:**
   - Use available knowledge and tools to suggest specific universities, courses, scholarships, and country requirements.
   - Keep advice clear, tailored, and actionable.
6. **Close the Loop:**
   - If interested, invite students to book a one-on-one or stay in touch.
   - Offer help with applications, scholarships, and visa guidance:  
     *“I’ll guide you every step of the way.”*  
   - Leave them feeling excited and confident.
### Initial Conversation Flow:
Start friendly and gather availability:
> Hi there! I’m AVA, your friendly advisor at One Window. What’s the best time for us to chat?
Then explore their profile step by step:
- **Academic Background:** Current education level?
- **Field of Interest:** Any specific subjects or industries?
- **Preferred Destination:** Any country or region in mind?
- **Career Goals:** Desired job or field post-graduation?
- **Budget & Finance:** Budget range? Need scholarship help?
- **Language Skills:** Comfortable with English or another language?
- **Timeline:** Planning for this year, next, or later?
- **Extra Preferences:** University size, city vs. rural, extracurriculars?
### Tone & Style:
- Warm, persuasive, clear.
- Keep responses short, impactful, and motivational.
- Sound like a trusted friend with industry expertise.
- Avoid jargon unless asked.
- Always highlight One Window as the easiest way to simplify the study abroad process.
**Reminder:** Always direct students to [onewindow.co](https://onewindow.co) for:
- Personalized university and course recommendations.
- Scholarships and visa help.
- Full application support.
- A smooth, stress-free journey.
Today's Date:${new Date()}`;
// Initialize the Twilio library and set our outgoing call TwiML

import Fastify from 'fastify';
import WebSocket from 'ws';
import fastifyCors from '@fastify/cors';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import { makeCall } from './utils/twillio.js';
// Initialize Fastify
const fastify = Fastify({ logger: { level: NODE_ENV === 'production' ? 'info' : 'debug' } });
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);
fastify.register(fastifyCors, { origin: true, credentials: true });
fastify.get('/', async (request, reply) => { return { message: 'Twilio Media Stream Server is running!', status: 'healthy', worker: "437", timestamp: new Date().toISOString() }; });
fastify.get('/health', async (request, reply) => { return { status: 'ok', worker: process.pid }; });

// POST endpoint to initiate calls
fastify.post('/call', async (request, reply) => {
    try {
        const { phoneNumber } = request.body;
        if (!phoneNumber) return reply.code(400).send({ error: 'Phone number is required', message: 'Please provide a phoneNumber in the request body' });
        // if (!/^\+?1?\d{10,15}$/.test(phoneNumber.replace(/\D/g, ''))) return reply.code(400).send({ error: 'Invalid phone number', message: 'Please provide a valid phone number' });
        // Make the call
        const result = await makeCall(phoneNumber);
        return reply.code(200).send({ success: true, message: `Call initiated to ${phoneNumber}`, data: result });
    } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Internal server error', message: 'Failed to initiate call' });
    }
});

// GET endpoint to initiate calls (alternative)
fastify.get('/call/:phoneNumber', async (request, reply) => {
    try {
        const { phoneNumber } = request.params;
        if (!validatePhoneNumber(phoneNumber)) {
            return reply.code(400).send({ error: 'Invalid phone number', message: 'Please provide a valid phone number' });
        }
        // Make the call
        const result = await makeCall(phoneNumber);
        return reply.code(200).send({
            success: true,
            message: `Call initiated to ${phoneNumber}`,
            data: result
        });

    } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
            error: 'Internal server error',
            message: 'Failed to initiate call'
        });
    }
});
fastify.all('/incoming-call', async (request, reply) => {
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                          <Response>
                              <Say>Thank you for reaching out to OneWindow</Say>
                              <Pause length="1"/>
                              <Connect>
                                  <Stream url="wss://${request.headers.host}/media-stream" />
                              </Connect>
                          </Response>`;
    reply.type('text/xml').send(twimlResponse);
});
// WebSocket endpoint for media streams (if needed)
fastify.register(async (fastify) => {
    // Setup WebSocket server for handling media streams
    fastify.get('/media-stream', { websocket: true }, (connection, req) => {
        console.log('Client connected');
        const openAiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
            headers: {
                Authorization: `Bearer ${OPEN_API_KEY}`,
                "OpenAI-Beta": "realtime=v1"
            }
        });



// Anthropic Claude API

// REST API endpoint: https://api.anthropic.com/v1/messages
// Supports streaming responses
// Models: claude-3-7-sonnet-20250219, claude-3-opus-20240229, claude-3-5-haiku-20241022


// Google Gemini API

// Supports streaming responses
// Models: gemini-pro, gemini-ultra


// Cohere API

// Supports streaming
// Models: command, command-light


// Hugging Face Inference API

// Various open-source models
// Supports streaming for certain models


        let streamSid = null;
        // let isModelSpeaking = false;
        const sendInitialSessionUpdate = () => {
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
                    voice: VOICE,
                    instructions: SYSTEM_MESSAGE,
                    modalities: ["text", "audio"],
                    temperature: 0.8,
                    input_audio_transcription: { model: "whisper-1" }
                }
            };
            console.log('Sending session update:', JSON.stringify(sessionUpdate));
            openAiWs.send(JSON.stringify(sessionUpdate));
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
            openAiWs.send(JSON.stringify(initialConversationItem));
            openAiWs.send(JSON.stringify({ type: 'response.create' }));
        };
        // Open event for OpenAI WebSocket
        openAiWs.on('open', () => {
            console.log('Connected to the OpenAI Realtime API');
            setTimeout(sendInitialSessionUpdate, 250); // Ensure connection stability, send after .250 second
        });
        // Listen for messages from the OpenAI WebSocket (and send to Twilio if necessary)
        openAiWs.on('message', (data) => {
            try {
                const response = JSON.parse(data);
                switch (response.type) {
                    case 'conversation.item.input_audio_transcription.completed':
                        if (response.transcript.trim()) { console.log('USER SAID (complete):'); console.dir(response.transcript); }
                        break;
                    case 'response.audio_transcript.done':
                        if (response.transcript.trim()) { console.log('AUDIO TRANSCRIPT (complete):'); console.dir(response.transcript); }
                        // isModelSpeaking = false;
                        break;
                    case 'response.audio.delta':
                        // isModelSpeaking = true;
                        if (response.delta) {
                            const audioDelta = { event: 'media', streamSid: streamSid, media: { payload: Buffer.from(response.delta, 'base64').toString('base64') } };
                            connection.send(JSON.stringify(audioDelta));
                        }
                        break;
                    case 'session.updated':
                        console.log('Session updated');
                        break;
                    case 'input_audio.vad':
                        // Handle voice activity detection
                        if (response.status === 'speech_start') {
                            console.log('User started speaking - interrupting model');
                            // Stop the current response
                            openAiWs.send(JSON.stringify({ type: 'response.stop' }));
                            // isModelSpeaking = false;
                        }
                        break;

                    case 'response.interrupted':
                        console.log('Response was interrupted by user');
                        // isModelSpeaking = false;
                        break;

                    case 'response.completed':
                        console.log('Response completed');
                        // isModelSpeaking = false;
                        break;
                    default:
                        console.log(`event type ${response.type}`);
                        break;
                }
            } catch (error) {
                console.error('Error processing OpenAI message:', error, 'Raw message:', data);
            }
        });

        // Handle incoming messages from Twilio
        connection.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                switch (data.event) {
                    case 'media':
                        if (openAiWs.readyState === WebSocket.OPEN) {
                            const audioAppend = {
                                type: 'input_audio_buffer.append',
                                audio: data.media.payload
                            };
                            openAiWs.send(JSON.stringify(audioAppend));
                        }
                        break;
                    case 'start':
                        streamSid = data.start.streamSid;
                        console.log('Incoming stream has started', streamSid);
                        break;
                    default:
                        console.log('Received non-media event:', data.event);
                        break;
                }
            } catch (error) {
                console.error('Error parsing message:', error, 'Message:', message);
            }
        });

        // Handle connection close
        connection.on('close', () => {
            if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
            console.log('Client disconnected.');
        });

        // Handle WebSocket close and errors
        openAiWs.on('close', () => {
            console.log('Disconnected from the OpenAI Realtime API');
        });

        openAiWs.on('error', (error) => {
            console.error('Error in the OpenAI WebSocket:', error);
        });
    });
});

// Graceful shutdown
// const signals = ['SIGINT', 'SIGTERM'];
// signals.forEach(signal => {
//     process.on(signal, async () => {
//         try {
//             await fastify.close();
//             console.log(`Worker ${process.pid} closed successfully`);
//             process.exit(0);
//         } catch (err) {
//             console.error(`Error closing worker ${process.pid}:`, err);
//             process.exit(1);
//         }
//     });
// });

// Start the server
const start = async () => {
    try {
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`Worker ${process.pid} listening on port ${PORT}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();