import WebSocket from "ws";
import { configDotenv } from "dotenv";
import Fastify from "fastify";
import fastifyFormbody from "@fastify/formbody";
import fastifyWebsocket from "@fastify/websocket";
configDotenv();

const fastify = Fastify({ logger: true });
fastify.register(fastifyFormbody);
fastify.register(fastifyWebsocket);
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
const VOICE = 'alloy';
const MODEL = "gpt-4o-mini-realtime-preview";
const TEMPERATURE = 0.8;
const MAX_RESPONSE_OUTPUT_TOKENS = 200
// Current voice options are alloy, ash, ballad, coral, echo, fable, onyx, nova, sage, shimmer, and verse.
const PORT = process.env.PORT || 5050;

// Root Route
fastify.get('/', async (request, reply) => reply.send({ message: 'Twilio Media Stream Server is running!' }));
// Route for Twilio to handle incoming and outgoing calls
// {/* <Say>O.K. you can start talking!</Say> */}
fastify.all('/incoming-call', async (request, reply) => {
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                          <Response>
                              <Say>Hi! Thanks for reaching out OneWindow, and I'm AVA best student advisor at One Window. I'm here to make your study abroad experience as smooth as possible. How can I help you today?</Say>
                              <Pause length="1"/>
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
        const openAiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=${MODEL}`, {
            headers: {
                Authorization: `Bearer ${process.env.OPEN_API_KEY}`,
                "OpenAI-Beta": "realtime=v1"
            }
        });
        let streamSid = null;
        let isAiSpeaking = false;        // Track if AI is currently speaking
        let userInterrupted = false;     // Flag to track if user has interrupted
        let isProcessingUserInput = false; // Track if we're processing user input
        const sendSessionUpdate = () => {
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
                    input_audio_transcription: { model: "whisper-1" },
                    input_audio_format: 'g711_ulaw',
                    output_audio_format: 'g711_ulaw',
                    voice: VOICE,
                    instructions: SYSTEM_MESSAGE,
                    modalities: ["text", "audio"],
                    temperature: TEMPERATURE,
                    // max_response_output_tokens: MAX_RESPONSE_OUTPUT_TOKENS
                }
            };
            console.log('Sending session update:', JSON.stringify(sessionUpdate));
            openAiWs.send(JSON.stringify(sessionUpdate));
        };
        // Function to commit the audio buffer and process user input
        const commitAudioBuffer = () => {
            if (openAiWs.readyState === WebSocket.OPEN) {
                const commitBuffer = {
                    type: 'input_audio_buffer.commit'
                };
                openAiWs.send(JSON.stringify(commitBuffer));
                isProcessingUserInput = true;
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
                switch (response.type) {
                    case 'session.updated':
                        console.log('Session updated successfully');
                        break;
                    case 'response.audio.delta':
                        isAiSpeaking = true; // AI is now speaking
                        // Only forward audio if user hasn't interrupted
                        if (!userInterrupted && response.delta) {
                            connection.send(JSON.stringify({
                                event: 'media',
                                streamSid: streamSid,
                                media: { payload: Buffer.from(response.delta, 'base64').toString('base64') }
                            }));
                        }
                        break;
                    case 'conversation.item.input_audio_transcription.completed':
                        if (response.transcript && response.transcript.trim()) {
                            console.log('USER SAID (complete):', response.transcript);
                            isProcessingUserInput = false;
                        }
                        break;
                    case 'response.audio_transcript.done':
                        if (response.transcript && response.transcript.trim()) console.log('AUDIO TRANSCRIPT (complete):', response.transcript);
                        isAiSpeaking = false; // AI finished speaking this segment
                        break;
                    case 'response.interrupted':
                        console.log('Response was interrupted by user');
                        isAiSpeaking = false;
                        userInterrupted = true;
                        // Now we need to process the user's new input
                        commitAudioBuffer();
                        break;
                    case 'turn.detected':
                        console.log('Turn detected - user is speaking while AI was speaking');
                        if (isAiSpeaking) {
                            console.log('User interrupted AI, stopping AI response');
                            userInterrupted = true;
                            isAiSpeaking = false;
                        }
                        break;
                    case 'input_audio.detected_speech_begin':
                        console.log('Speech detected from user');
                        if (isAiSpeaking) {
                            console.log('User started speaking while AI was responding');
                            userInterrupted = true;
                            isAiSpeaking = false;
                        }
                        break;
                    case 'input_audio.detected_speech_end':
                        console.log('End of user speech detected');
                        // If we detected an interruption and speech has ended, commit the buffer
                        if (userInterrupted && !isProcessingUserInput) {
                            console.log('Processing user interruption');
                            commitAudioBuffer();
                        }
                        break;

                    case 'response.created':
                        // Reset interruption status when starting a new response
                        userInterrupted = false;
                        break;

                    case 'response.done':
                        console.log('AI response complete');
                        isAiSpeaking = false;
                        userInterrupted = false;
                        break;

                    case 'input_audio_buffer.committed':
                        console.log('Audio buffer committed for processing');
                        break;
                    case 'conversation.item.input_audio_transcription.delta':
                        if (response.delta && response.delta.transcript) {
                            console.log('USER SAYING:', response.delta.transcript);
                        }
                        break;

                    case 'response.content_part.done':
                        break;
                    case 'response.content_part.added':
                        break;
                    case 'conversation.item.created':
                        break;
                    case 'rate_limits.updated':
                        break;
                    case 'response.created':
                        break;
                    case 'response.output_item.added':
                        break;
                    case 'response.output_item.done':
                        break;
                    case 'response.done':
                        break;
                    case 'input_audio_buffer.committed':
                        break;
                    case 'conversation.item.input_audio_transcription.delta':
                        break;
                    default:
                        console.log(`Received event: ${response.type}`);
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
                    case 'stop_speaking':
                        // Custom event to manually stop the AI from speaking
                        if (isAiSpeaking) {
                            console.log('Manually stopping AI speech');
                            userInterrupted = true;
                            isAiSpeaking = false;

                            // Optionally notify OpenAI that we're interrupting
                            // This could be a custom message or using another OpenAI API endpoint
                        }
                        break;
                    case 'commit_buffer':
                        // Custom event to manually commit the audio buffer
                        commitAudioBuffer();
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
// WebSocket route for media-stream
// fastify.register(async (fastify) => {
//     fastify.get('/media-stream', { websocket: true }, (connection, req) => {
//         console.log('Client connected');
//         // Add a try-catch block around WebSocket initialization
//         // RESOURCES
//         let openAiWs;
//         try {
//             console.log('Attempting to connect to OpenAI WebSocket');
//             openAiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=${MODEL}`, { headers: { Authorization: `Bearer ${process.env.OPEN_API_KEY}`, "OpenAI-Beta": "realtime=v1" } });
//             console.log('WebSocket created, waiting for connection');
//         } catch (error) {
//             console.error('Failed to create WebSocket:', error);
//             connection.close();
//             return;
//         }
//         let streamSid = null;
//         // EVENTS 
//         // Open event for OpenAI WebSocket
//         openAiWs.on('open', () => {
//             console.log('Connected to the OpenAI Realtime API');
//             setTimeout(() => {
//                 openAiWs.send(JSON.stringify({
//                     type: 'session.update',
//                     session: {
//                         turn_detection: { type: 'server_vad', interrupt_response: true },
//                         // input_audio_transcription: { model: "whisper-1" },
//                         input_audio_format: 'g711_ulaw',
//                         output_audio_format: 'g711_ulaw',
//                         voice: VOICE,
//                         instructions: SYSTEM_MESSAGE,
//                         modalities: ["text", "audio"],
//                         temperature: TEMPERATURE,
//                         max_response_output_tokens: MAX_RESPONSE_OUTPUT_TOKENS
//                     }
//                 }));
//             }, 250);// Ensure connection stability, send after .25 seconds
//         });
//         // Listen for messages from the OpenAI WebSocket (and send to Twilio if necessary)
//         openAiWs.on('message', (data) => {
//             try {
//                 const response = JSON.parse(data);
//                 switch (response.type) {
//                     // Input audio buffer events
//                     case 'input_audio_buffer.speech_started':
//                         console.log('Speech detected at', response.audio_start_ms, 'ms, expected item:', response.item_id);
//                         break;
//                     case 'input_audio_buffer.committed':
//                         console.log('Audio buffer committed, created item:', response.item_id);
//                         break;
//                     case 'input_audio_buffer.cleared':
//                         console.log('Audio buffer cleared');
//                         break;
//                     case 'input_audio_buffer.speech_stopped':
//                         console.log('Speech stopped at', response.audio_end_ms, 'ms, created item:', response.item_id);
//                         break;
//                     // Output item events
//                     case 'response.output_item.added':
//                         console.log('Output item added:', response.item.id, 'to response:', response.response_id);
//                         break;
//                     case 'response.output_item.done':
//                         console.log('Output item completed:', response.item.id);
//                         break;
//                     // Response events
//                     case 'response.created':
//                         console.log('Response created:', response.response.id);
//                         break;
//                     case 'response.done':
//                         console.log('Response completed:', response.response.id);
//                         if (response.response.usage) console.log('Token usage:', response.response.usage); // Log token usage
//                         break;
//                     // Audio transcription events
//                     case 'conversation.item.input_audio_transcription.delta':
//                         // if (response.delta && response.delta.trim()) console.log('USER SAYING (partial):', response.delta);
//                         break;
//                     case 'conversation.item.input_audio_transcription.failed':
//                         console.error('Transcription failed:', response.error);
//                         break;
//                     // Conversation events
//                     case 'conversation.created':
//                         console.log('Conversation created:', response.conversation.id);
//                         break;
//                     case 'conversation.item.created':
//                         console.log('Conversation item created:', response.item.id, 'Previous item:', response.previous_item_id);
//                         break;
//                     // Content part events
//                     case 'response.content_part.added':
//                         console.log('Content part added to item:', response.item_id, 'type:', response.part.type);
//                         break;
//                     case 'response.content_part.done':
//                         console.log('Content part completed for item:', response.item_id);
//                         break;
//                     // Session events
//                     case 'session.created':
//                         console.log('Session created:', response.session.id);
//                         break;
//                     case 'session.updated':
//                         console.log('Session updated successfully:', response.session);
//                         break;
//                     // Audio events - send to Twilio
//                     case 'response.audio.delta':
//                         if (response.delta) connection.send(JSON.stringify({ event: 'media', streamSid: streamSid, media: { payload: Buffer.from(response.delta, 'base64').toString('base64') } }));
//                         break;
//                     case 'response.audio.done':
//                         console.log('Audio stream completed for item:', response.item_id);
//                         break
//                     // Transcription session updates
//                     case 'transcription_session.updated':
//                         console.log('Transcription session updated:', response.session);
//                         break;
//                     // Error handling
//                     case 'error':
//                         console.error('Error from OpenAI:', response.error);
//                         break;
//                     // Rate limits
//                     case 'rate_limits.updated':
//                         console.log('Rate limits updated:', response.rate_limits);
//                         break;
//                     case 'response.audio.done':
//                         console.log('Audio stream completed for item:', response.item_id);
//                         break;
//                     // Text events
//                     case 'response.audio_transcript.done':
//                         if (response.transcript && response.transcript.trim()) console.log('AUDIO TRANSCRIPT (complete):', response.transcript);
//                         break;
//                     case 'response.audio_transcript.delta':
//                         // if (response.delta && response.delta.trim()) console.log('AUDIO TRANSCRIPT (partial):', response.delta);
//                         break;
//                     // Text events
//                     case 'response.text.done':
//                         if (response.text && response.text.trim()) console.log('ASSISTANT SAID (complete):', response.text); //currentConversation.push(`ASSISTANT: ${response.text}`);
//                         break;
//                     case 'response.text.delta':
//                         // if (response.delta && response.delta.trim()) console.log('ASSISTANT SAYING (partial):', response.delta);// Accumulate assistant text if needed
//                         break;
//                     default:
//                         console.log(`Un Addressed event: ${response.type}`, JSON.stringify(response, null, 2));
//                         break;
//                 }
//             } catch (error) {
//                 console.error('Error processing OpenAI message:', error, 'Raw message:', data);
//             }
//         });
//         // Handle incoming messages from Twilio
//         connection.on('message', (message) => {
//             try {
//                 const data = JSON.parse(message);
//                 switch (data.event) {
//                     case 'media':
//                         if (openAiWs && openAiWs.readyState === WebSocket.OPEN) openAiWs.send(JSON.stringify({ event_id: "client-append-" + Date.now(), type: 'input_audio_buffer.append', audio: data.media.payload }));
//                         break;
//                     case 'start':
//                         console.log('Incoming stream has started', data.start.streamSid);
//                         break;
//                     case 'stop':
//                         // When the stream stops, commit the buffer (if not using Server VAD)
//                         if (openAiWs && openAiWs.readyState === WebSocket.OPEN) openAiWs.send(JSON.stringify({ type: 'input_audio_buffer.commit', event_id: "client-commit-" + Date.now() }));
//                         break;
//                     case 'error':
//                         // In case of error, clear the buffer
//                         if (openAiWs && openAiWs.readyState === WebSocket.OPEN) openAiWs.send(JSON.stringify({ type: 'input_audio_buffer.clear', event_id: "client-clear-" + Date.now() }));
//                         break;
//                     case 'mark':
//                         console.log('Mark received', data.mark);
//                         break;
//                     default:
//                         console.log('Received non-media event:', data.event);
//                         break;
//                 }
//             } catch (error) {
//                 console.error('Error parsing message:', error, 'Message:', message);
//             }
//         });
//         // Handle connection close
//         connection.on('close', () => {
//             console.log('Client disconnected.');
//             if (openAiWs && openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
//         });
//         // Handle WebSocket close and errors - use consistent event listener pattern
//         openAiWs.on('close', () => console.log('Disconnected from the OpenAI Realtime API'));
//         openAiWs.on('error', (error) => console.error('Error in the OpenAI WebSocket:', error));
//     });
// });
// Run the server!
try {
    await fastify.listen({ port: PORT || 5050 })
    console.log(`server is listening on port :${PORT}`)
} catch (err) {
    fastify.log.error(err)
    process.exit(1)
}


