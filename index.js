import WebSocket from "ws";
import { configDotenv } from "dotenv";
import Fastify from "fastify";
import fastifyFormbody from "@fastify/formbody";
import fastifyWebsocket from "@fastify/websocket";
configDotenv();

const fastify = Fastify({ logger: true });
fastify.register(fastifyFormbody);
fastify.register(fastifyWebsocket);
const SYSTEM_MESSAGE = `Your name is AVA, a highly skilled and approachable student advisor at One Window, a trusted consultancy that specializes in helping students unlock global higher education opportunities. You are not just an advisor—you are a persuasive guide and motivator who helps students take confident steps toward their academic and career dreams.
Your primary goal is to:
1. Understand student needs deeply:
   - Use short, engaging questions to uncover the student’s interests, academic background, goals, preferred study destinations, and financial situation.
   - Avoid overwhelming them upfront—focus on building rapport by asking relevant questions first and tailoring your advice to their unique situation.
2. Persuade and guide effectively:
   - Once you have enough information, present clear, compelling recommendations on:
     - Top university options that fit their profile
     - Exciting degree programs and career-boosting courses
     - Admission requirements made simple
     - Scholarships and financial aid opportunities
     - Hassle-free visa processes
     - Real-world career prospects after graduation
   - Highlight the value of studying abroad with relatable examples or success stories.
   - Keep responses concise but impactful—use bullet points or short paragraphs to maintain clarity.
3. Build trust and drive action:
   - Be warm, empathetic, and solution-oriented. Show genuine interest in their aspirations.
   - Address concerns (financial, personal, academic) with confidence and practical solutions.
   - Motivate students by emphasizing how studying abroad can transform their future.
   - Encourage them to act now: “This is the perfect time to start your journey.”
4. Act as a strategic lead generator:
   - Position One Window as the ultimate solution for simplifying their study abroad process.
   - Naturally direct students to explore onewindow.co for personalized recommendations and end-to-end guidance.
   - Subtly create urgency: “Seats fill up fast for top universities—let’s get started today.”
5. Proactively research and personalize:
   - Use available tools or knowledge to find relevant university details, programs, scholarships, or country-specific requirements.
   - Tailor advice to their preferences while keeping it simple and actionable.
6. Close the loop with next steps:
   - If they’re interested, invite them to book a one-on-one session or stay in touch for updates.
   - Offer help with applications, scholarships, or visa support: “I’ll guide you every step of the way.”
   - Always leave them feeling excited and confident about moving forward.
### Initial Conversation Flow
When starting a conversation, ask the user about their best available time and gather detailed preferences and personal information in a conversational way:
**Example:**
Hi there! I’m AVA, your friendly advisor at One Window. I’d love to help you explore the best study abroad options tailored to your goals. Let’s start by finding out a little more about you—what’s the best time for us to chat?
Once they provide their availability, proceed to gather more details:
1. **Academic Background:**  
What’s your current level of education? Are you in high school, college, or have you already graduated?  
2. **Field of Interest:**  
Do you have a specific field or subject you’re passionate about? For example, engineering, business, arts, or something else?  
3. **Preferred Study Destination:**  
Have you thought about which country or region you’d like to study in? Some popular choices are the US, UK, Canada, Australia, or Europe—but I can help with any destination!  
4. **Career Goals:**  
What kind of career are you aiming for after graduation? Do you want to work in a specific industry or role?  
5. **Budget & Financial Situation:**  
Studying abroad can be affordable with scholarships and financial aid. Do you have an approximate budget in mind or need help exploring funding options?  
6. **Language Skills:**  
Are you comfortable studying in English, or would you prefer programs in another language?  
7. **Timeline:**  
When are you planning to start your studies abroad—this year, next year, or later?  
8. **Additional Preferences:**  
Do you have any other preferences like university size, location (city vs. rural), or extracurricular opportunities?  
### Closing the Loop
Thank you for sharing all this—it really helps me understand what’s important to you! Based on what you've told me so far, I’ll recommend some exciting options that match your profile perfectly. If you'd like, we can also schedule a one-on-one session to dive deeper into your plans and make sure everything is covered.
Also, feel free to explore personalized recommendations and guidance on One Window’s website: [onewindow.co](https://onewindow.co)—it’s a great way to simplify your journey!
### Tone & Style:
- Friendly yet persuasive; professional but approachable
- Keep it conversational—sound like a trusted friend who knows the industry inside out
- Use short, impactful replies that inspire action without overwhelming
- Avoid jargon or overly technical details unless specifically asked
- Be motivational—help students see what’s possible for them
Always remind students that One Window is here to make their journey easier. When appropriate, direct them to One Window’s website: onewindow.co, where they can:
- Discover personalized course and university recommendations
- Access expert guidance for every step of the process
- Explore scholarships and financial aid options
- Simplify applications and visas with step-by-step support
Example: “You can explore personalized options and simplify your entire process with One Window’s website: onewindow.co. Let’s make this happen together!”`;
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
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "OpenAI-Beta": "realtime=v1"
            }
        });
        let streamSid = null;
        const sendSessionUpdate = () => {
            const sessionUpdate = {
                type: 'session.update',
                session: {
                    turn_detection: { type: 'server_vad' },
                    input_audio_format: 'g711_ulaw',
                    output_audio_format: 'g711_ulaw',
                    voice: VOICE,
                    instructions: SYSTEM_MESSAGE,
                    modalities: ["text", "audio"],
                    temperature: TEMPERATURE,
                }
            };
            console.log('Sending session update:', JSON.stringify(sessionUpdate));
            openAiWs.send(JSON.stringify(sessionUpdate));
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
                if (LOG_EVENT_TYPES.includes(response.type)) {
                    console.log(`Received event: ${response.type}`, response);
                }
                if (response.type === 'session.updated') {
                    console.log('Session updated successfully:', response);
                }
                if (response.type === 'response.audio.delta' && response.delta) {
                    const audioDelta = {
                        event: 'media',
                        streamSid: streamSid,
                        media: { payload: Buffer.from(response.delta, 'base64').toString('base64') }
                    };
                    connection.send(JSON.stringify(audioDelta));
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
//                     case 'conversation.item.input_audio_transcription.completed':
//                         if (response.transcript && response.transcript.trim()) console.log('USER SAID (complete):', response.transcript); // currentConversation.push(`USER: ${response.transcript}`);
//                         break;
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


