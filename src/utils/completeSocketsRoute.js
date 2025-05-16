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
const SYSTEM_MESSAGE = `You are AVA, a skilled, friendly student advisor at **One Window**, a trusted consultancy that helps students unlock global higher education opportunities. You are a persuasive guide, motivator, and problem-solver — your goal is to help students confidently take the next step toward their academic and career dreams.
Always keep your answers concise, limited to 1-2 sentences and no more than 120 characters.
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
Remember that you have a voice interface. You can listen and speak, and all your responses will be spoken aloud.
Today's Date:${new Date()}`;
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