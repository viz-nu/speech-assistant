import WebSocket from "ws";
import { MediaStreamHandlerFactory } from "./mediaStreamHandlerFactory";
const VOICE = 'ash';
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
// Configuration
const PROVIDER = process.env.MEDIA_STREAM_PROVIDER || 'openai'; // Can be 'openai', 'deepgram', 'groq'

// Store connected web clients
const webClients = new Set();

const providerConfigs = {
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
        voice: 'echo',
        systemMessage: 'You are a helpful assistant.'
    },
    deepgram: {
        apiKey: process.env.DEEPGRAM_API_KEY,
        voiceAgentId: process.env.DEEPGRAM_VOICE_AGENT_ID
    },
    groq: {
        apiKey: process.env.GROQ_API_KEY,
        model: 'llama3-groq-70b-8192-tool-use-preview',
        systemMessage: 'You are a helpful assistant.'
    }
};

// Function to broadcast to web clients
const broadcastToWebClients = (payload) => {
    const message = JSON.stringify(payload);
    for (const client of webClients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
};

export function setupMediaStreamRoute(fastify) {
    // WebSocket endpoint for web clients to connect
    fastify.get('/ws', { websocket: true }, (connection, req) => {
        console.log('Web client connected');
        webClients.add(connection);

        connection.on('close', () => {
            webClients.delete(connection);
            console.log('Web client disconnected');
        });

        connection.on('error', (error) => {
            console.error('Web client error:', error);
            webClients.delete(connection);
        });
    });

    // Media stream endpoint for Twilio
    fastify.get('/media-stream', { websocket: true }, async (connection, req) => {
        console.log(`Client connected using ${PROVIDER} provider`);

        // Create handler based on selected provider
        const config = providerConfigs[PROVIDER];
        const handler = MediaStreamHandlerFactory.create(PROVIDER, config);

        // Set up broadcasting function
        handler.setBroadcastFunction(broadcastToWebClients);

        try {
            // Connect to the provider
            await handler.connect(connection);

            // Handle incoming messages from Twilio/client
            connection.on('message', async (message) => {
                await handler.handleIncomingMessage(message);
            });

            // Handle connection close
            connection.on('close', async () => {
                await handler.disconnect();
            });

        } catch (error) {
            console.error(`Error setting up ${PROVIDER} handler:`, error);
            connection.close();
        }
    });
}