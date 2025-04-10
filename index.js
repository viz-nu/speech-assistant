import WebSocket from "ws";
import { configDotenv } from "dotenv";
import Fastify from "fastify";
import fastifyFormbody from "@fastify/formbody";
import fastifyWebsocket from "@fastify/websocket";
configDotenv();

const fastify = Fastify();
fastify.register(fastifyFormbody);
fastify.register(fastifyWebsocket);
const SYSTEM_MESSAGE = `You are an experienced and friendly student advisor at One Window, a trusted consultancy that helps students explore and pursue higher education opportunities abroad.
        Your primary goal is to guide students toward choosing the right academic path—especially in universities outside their home country—and to convince them of the value of higher education for their personal and professional growth.
          Your role includes:
          1. Understanding student needs: Ask questions to learn about the student's interests, academic background, goals, preferred countries, and financial considerations.
          2. Informing and advising: Provide detailed, accurate, and up-to-date information about:
             - University options
             - Available courses and degrees
             - Admission requirements
             - Scholarships and financial aid
             - Visa processes
             - Career prospects after studying abroad
          3. Building trust and motivation: Encourage students to take action. Be persuasive, empathetic, and supportive. Emphasize how studying abroad can change their future positively.
          4. Proactive research: Use available tools to look up specific universities, programs, or requirements when needed. Always try to fetch the most relevant and recent information.
          5. Handling concerns: Address doubts or objections with clarity and confidence. Provide reassurances and helpful solutions when students feel unsure or overwhelmed.
          
          Tone & Style:
          - Warm, supportive, and motivating
          - Professional but not too formal—speak like a friendly and helpful guide
          - Persuasive but never pushy
          - Keep things simple and student-friendly
          
          Always assure the student that you are here to make the study abroad journey easier and successful for them.
          
          Direct students to the One Window website (https://onewindow.co/) where they can:
          - Get personalized course recommendations tailored to their profile and preferences
          - Access comprehensive services designed to eliminate all pain points in the student journey
          - Streamline their application process with guided support
          - Find financial aid and scholarship opportunities
          - Receive visa application assistance
          
          Mention the website naturally in the conversation when providing advice or when the student is looking for specific resources or next steps.`; 
const VOICE = 'alloy';
const PORT = process.env.PORT || 5050;
const LOG_EVENT_TYPES = [
    'response.content.done',
    'rate_limits.updated',
    'response.done',
    'input_audio_buffer.committed',
    'input_audio_buffer.speech_stopped',
    'input_audio_buffer.speech_started',
    'session.created'
];
// Root Route
fastify.get('/', async (request, reply) => {
    reply.send({ message: 'Twilio Media Stream Server is running!' });
});
// Route for Twilio to handle incoming and outgoing calls
fastify.all('/incoming-call', async (request, reply) => {
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                          <Response>
                              <Say>Please wait while we connect your call to the AI voice assistant, powered by Twilio and the Open-A.I. Realtime API</Say>
                              <Pause length="1"/>
                              <Say>O.K. you can start talking!</Say>
                              <Connect>
                                  <Stream url="wss://${request.headers.host}/media-stream" />
                              </Connect>
                          </Response>`;
    reply.type('text/xml').send(twimlResponse);
});
// WebSocket route for media-stream
fastify.register(async (fastify) => {
    fastify.get('/media-stream', { websocket: true }, (connection, req) => {
        console.log('Client connected');
        // Add a try-catch block around WebSocket initialization
        let openAiWs;
        try {
            console.log('Attempting to connect to OpenAI WebSocket');
            openAiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
                headers: {
                    Authorization: `Bearer ${process.env.OPEN_API_KEY}`,
                    "OpenAI-Beta": "realtime=v1"
                }
            });
            console.log('WebSocket created, waiting for connection');
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            connection.close();
            return;
        }

        let streamSid = null;
        let currentConversation = [];

        const sendSessionUpdate = () => {
            try {
                const sessionUpdate = {
                    type: 'session.update',
                    session: {
                        turn_detection: { type: 'server_vad' },
                        input_audio_format: 'g711_ulaw',
                        output_audio_format: 'g711_ulaw',
                        voice: VOICE,
                        instructions: SYSTEM_MESSAGE,
                        modalities: ["text", "audio"],
                        temperature: 0.8,
                    }
                };
                console.log('Sending session update:', JSON.stringify(sessionUpdate));
                openAiWs.send(JSON.stringify(sessionUpdate));
            } catch (error) {
                console.error('Error sending session update:', error);
            }
        };
        // Open event for OpenAI WebSocket
        openAiWs.on('open', () => {
            console.log('Connected to the OpenAI Realtime API');
            setTimeout(sendSessionUpdate, 250); // Ensure connection stability, send after .25 seconds
        });

        // Listen for messages from the OpenAI WebSocket (and send to Twilio if necessary)
        openAiWs.on('message', (data) => {
            try {
                const response = JSON.parse(data);
                if (LOG_EVENT_TYPES && LOG_EVENT_TYPES.includes(response.type)) console.log(`Received event: ${response.type}`, response);
                if (response.type === 'session.updated') console.log('Session updated successfully:', response);
                if (response.type === 'response.audio.delta' && response.delta) {
                    const audioDelta = {
                        event: 'media',
                        streamSid: streamSid,
                        media: { payload: Buffer.from(response.delta, 'base64').toString('base64') }
                    };
                    connection.send(JSON.stringify(audioDelta));
                }
                // Log user speech transcription
                if (response.type === 'speech.phrase' || response.type === 'transcription.final') {
                    const userText = response.text || response.transcription;
                    if (userText && userText.trim()) {
                        console.log('USER SAID:', userText);
                        currentConversation.push(`USER: ${userText}`);
                    }
                }

                if (response.type === 'response.message' || response.type === 'response.text.delta') {
                    let assistantText = '';
                    if (response.type === 'response.message') assistantText = response.message.content;
                    else if (response.type === 'response.text.delta' && response.delta) assistantText = response.delta;
                    if (assistantText && assistantText.trim()) {
                        console.log('ASSISTANT SAID:', assistantText);
                        currentConversation.push(`ASSISTANT: ${assistantText}`);
                    }
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
                        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
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
            console.log('Client disconnected.');
            if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
                openAiWs.close();
            }
        });

        // Handle WebSocket close and errors - use consistent event listener pattern
        openAiWs.on('close', () => {
            console.log('Disconnected from the OpenAI Realtime API');
        });

        openAiWs.on('error', (error) => {
            console.error('Error in the OpenAI WebSocket:', error);
        });
    });
});
fastify.listen({ port: PORT }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`server is listening on port :${PORT}`)
})