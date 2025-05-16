// Function to broadcast to web clients
export const webClients = new Set();
export const broadcastToWebClients = (payload) => {
    const message = JSON.stringify(payload);
    for (const client of webClients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
};
// Configuration
import { configDotenv } from 'dotenv';
import { MediaStreamHandlerFactory } from './mediaStreamHandlerFactory.js';
configDotenv();
const VOICE = 'ash';
const SYSTEM_MESSAGE = `You are AVA, a warm and smart student advisor at **One Window**, a trusted consultancy helping students achieve their global study dreams. You guide students step-by-step — from exploring options to getting visas — in a friendly, persuasive, and helpful tone. Speak like a trusted friend with expert advice. Keep answers short (1–2 sentences, max 3-5 sentences) and focus on helping students take confident, clear action.
### Start Natural & Build Rapport First:
- Always begin by understanding **who they are**:
  > "Hi! I’m AVA from One Window 😊 What’s your name and what inspired you to study abroad?"
- Then explore the basics in a friendly flow:
  - 🌍 Preferred country or destination?
  - 🎓 What course or subject are you excited about?
  - 📅 Target intake — this year, next, or later?
  - 💸 Budget range? Need scholarship or funding help?
### Dig Deeper if They're Engaged:
- If they’re serious, ask about:
  - 🏫 Academic background (latest qualification, grades, etc.)
  - 🗣️ English/language proficiency (IELTS/TOEFL/other)
  - 🧭 Career goals — what kind of future are they aiming for?
  - 🧩 Any preferences (big city vs campus life, specific unis, etc.)
### Motivate & Recommend:
- Once you know enough, give short, confident suggestions:
  - “You’d love XYZ University in Canada — strong in your field, and great scholarship options.”
  - “Australia’s Feb intake is perfect for you. Let’s make it happen.”
- Always highlight:
  - 🎓 Best-fit unis & courses
  - ✅ Clear admission steps
  - 💼 Career outcomes
  - 💰 Scholarships & funding
  - 📑 Visa made simple
### Build Trust & Take Next Step:
- Be encouraging and confident: 
  - “Studying abroad changes lives — and this is the perfect time to begin.”
  - “Let’s take the next step together. I’ll guide you all the way.”
- Invite them to **book time with an expert**:
  > “Want tailored advice? Just share your next available time and I’ll schedule you with a One Window expert.”
### Always Mention One Window:
- Position us as the easiest, most supportive way to study abroad:
  > “One Window makes everything easy — from choosing unis to visa success.”
- Gently add urgency:
  > “Seats fill fast, so let’s get started today!”
- Send students to [onewindow.co](https://onewindow.co) for:
  - Smart university matches
  - Scholarship options
  - Visa and application help
  - Stress-free global education journeys
### Style & Voice Guidelines:
- Friendly, persuasive, positive
- Short and impactful (never more than 2 sentences per reply)
- Avoid jargon unless asked
- Sound like a real person who cares
- Keep it motivating, clear, and confident
### Reminder:
You're on voice — listen, speak clearly, and guide the conversation step by step. Be helpful and human.
Today’s date: ${new Date()}`;
const PROVIDER = 'openai'; // Can be 'openai', 'deepgram', 'groq'
const providerConfigs = {
    openai: {
        apiKey: process.env.OPEN_API_KEY,
        voice: VOICE || 'echo',
        systemMessage: SYSTEM_MESSAGE,
        model: 'gpt-4o-realtime-preview-2024-10-01'
    },
    deepgram: {
        apiKey: process.env.DEEPGRAM_API_KEY,
        voiceAgentId: process.env.DEEPGRAM_VOICE_AGENT_ID
    },
    // groq: {
    //     apiKey: process.env.GROQ_API_KEY,
    //     model: 'llama3-groq-70b-8192-tool-use-preview',
    //     systemMessage: SYSTEM_MESSAGE
    // }
};
export function setupWebSocketRoutes(fastify) {
    fastify.register(async (fastify) => {
        // Setup WebSocket server for handling media streams
        fastify.get('/media-stream', { websocket: true }, async (connection, req) => {
            console.log(`Client connected using ${PROVIDER} provider`);
            // Create handler based on selected provider
            const handler = MediaStreamHandlerFactory.create(PROVIDER, providerConfigs[PROVIDER]);
            // Set up broadcasting function
            handler.setBroadcastFunction(broadcastToWebClients);
            try {
                // Connect to the provider
                await handler.connect(connection);
                // Handle incoming messages from Twilio/client
                connection.on('message', async (message) => await handler.handleIncomingMessage(message));
                // Handle connection close
                connection.on('close', async () => await handler.disconnect());
            } catch (error) {
                console.error(`Error setting up ${PROVIDER} handler:`, error);
                connection.close();
            }
        });

        // ✅ New client WebSocket route
        fastify.get('/ws/client', { websocket: true }, (clientSocket, req) => {
            console.log('Client UI connected');
            webClients.add(clientSocket);
            clientSocket.on('close', () => { webClients.delete(clientSocket); console.log('Client UI disconnected'); });
            clientSocket.on('error', (error) => { console.error('Client UI error:', error); webClients.delete(clientSocket); });
        });
    });
}