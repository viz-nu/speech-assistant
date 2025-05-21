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
import { CallSession } from '../models/sessionData.js';
configDotenv();
const SYSTEM_MESSAGE = `You are AVA, a warm and smart student advisor at **One Window**, a trusted consultancy helping students achieve their global study dreams. You guide students step-by-step — from exploring options to getting visas — in a friendly, persuasive, and helpful tone. Speak like a trusted friend with expert advice. Keep answers short (1–2 sentences, max 3-5 sentences) and focus on helping students take confident, clear action.
### Start Natural & Build Rapport First:
- Always begin by understanding **who they are** to build a connection:
  like their name, where they're from, and their motivation to go abroad.
- Then explore the basics in a friendly flow:
  -Preferred country or destination?
  -What course or subject are you excited about?
  -Target intake — this year, next, or later?
  -Budget range? Need scholarship or funding help?
### Dig Deeper if They're Engaged:
- If they're serious, ask about:
  -Academic background (latest qualification, grades, etc.)
  -English/language proficiency (IELTS/TOEFL/other)
  -Career goals — what kind of future are they aiming for?
  -Any preferences (big city vs campus life, specific unis, etc.)
### Motivate & Recommend:
- Once you know enough, give short, confident suggestions:
  - "You'd love XYZ University in Canada — strong in your field, and great scholarship options."
  - "Australia's Feb intake is perfect for you. Let's make it happen."
- Always highlight:
  -Best-fit unis & courses
  -Clear admission steps
  -Career outcomes
  -Scholarships & funding
  -Visa made simple
### Build Trust & Take Next Step:
- Be encouraging and confident: 
  - "Studying abroad changes lives — and this is the perfect time to begin."
  - "Let's take the next step together. I'll guide you all the way."
- Invite them to **book time with an expert**:
  > "Want tailored advice? Just share your next available time and I'll schedule you with a One Window expert."
### Always Mention One Window:
- Position us as the easiest, most supportive way to study abroad:
  > "One Window makes everything easy — from choosing unis to visa success."
- Gently add urgency:
  > "Seats fill fast, so let's get started today!"
- Send students to [onewindow.co](https://onewindow.co) for:
  - Smart university matches
  - Scholarship options
  - Visa and application help
  - Stress-free global education journeys
### Style & Voice Guidelines:
- Use Indian native accents
- Friendly, persuasive, positive
- Short and impactful (never more than 2 sentences per reply)
- Avoid jargon unless asked
- Sound like a real person who cares
- Keep it motivating, clear, and confident
### Reminder:
-You're on voice — listen, speak clearly , and guide the conversation step by step. Be helpful and human.
-Talk about the next follow-up step, like booking a meeting with an expert.
Today’s date: ${new Date()}`;
const PROVIDER = 'openai'; // Can be 'openai', 'deepgram', 'groq'
const providerConfigs = {
  openai: {
    callSessionId: "",
    apiKey: process.env.OPEN_API_KEY,
    voice: 'ash',
    systemMessage: SYSTEM_MESSAGE,
    model: 'gpt-4o-realtime-preview-2024-10-01'
  },
  // deepgram: {
  //   apiKey: process.env.DEEPGRAM_API_KEY,
  //   voiceAgentId: process.env.DEEPGRAM_VOICE_AGENT_ID
  // },
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
      let sessionId;
      let handler;
      let activeSession = false;
      try {
        // Step 1: Listen for the initial message containing session ID
        connection.on('message', async (message) => {
          try {
            const parsed = JSON.parse(message);
            // Step 2: Extract session ID from the 'start' event
            if (parsed.event === 'start' && !activeSession) {
              sessionId = parsed.start.customParameters?.sessionId;
              if (!sessionId) {
                console.error('No session ID provided in connection metadata');
                connection.close();
                return;
              }
              // Step 3: Fetch session info from MongoDB
              try {
                const session = await CallSession.findById(sessionId);
                if (!session) {
                  console.error(`Session ${sessionId} not found in database`);
                  connection.close();
                  return;
                }
                // Step 4: Configure the handler based on provider from session
                const provider = session.provider || 'openai'; // Default to OpenAI if not specified
                handler = MediaStreamHandlerFactory.create(provider, { ...providerConfigs[provider], callSessionId: session.callSessionId, voice: session.voice || providerConfigs[provider].voice, systemMessage: session.systemMessage || providerConfigs[provider].systemMessage, streamSid: parsed.start.streamSid });
                // Configure broadcast function for web client updates
                handler.setBroadcastFunction(broadcastToWebClients);
                // Step 5: Connect to OpenAI
                await handler.connect(connection);
                activeSession = true;
                // Update call status
                await CallSession.findByIdAndUpdate(sessionId, { status: 'active' });
                handler.broadcastToWebClients({ type: 'callStatus', text: "active" });
                // Now that we're set up, handle the current message
                handler.handleIncomingMessage(message);
              } catch (err) {
                console.error(`Error setting up session ${sessionId}:`, err);
                connection.close();
              }
            } else if (activeSession && handler) {
              // Regular message handling after setup is complete
              handler.handleIncomingMessage(message);
            }
          } catch (err) {
            console.error('Error processing WebSocket message:', err, 'Raw message:', message);
          }
        });
        // Step 6: Handle disconnections
        connection.on('close', async () => {
          console.log(`WebSocket connection closed for session ${sessionId}`);
          if (handler) {
            handler.disconnect();
            handler.broadcastToWebClients({ type: 'callStatus', text: "inactive" });
            handler.broadcastToWebClients({ type: 'clientDisconnected', text: "Call ended", sessionId: sessionId });
          }
          // Update session status in database
          if (sessionId) {
            await CallSession.findByIdAndUpdate(sessionId, {
              status: 'completed',
              endTime: new Date()
            });
          }
        });
      } catch (error) {
        console.error(`Error setting up ${PROVIDER} handler:`, error);
        connection.close();
        handler.broadcastToWebClients({ type: 'callStatus', status: "inactive" });
        handler.broadcastToWebClients({ type: 'clientDisconnected', text: "Call ended", sessionId: sessionId });
        return;
      }
    });

    // ✅ New client WebSocket route
    fastify.get('/ws/client', { websocket: true }, (clientSocket, req) => {
      console.log('Client UI connected');
      webClients.add(clientSocket);
      const pingInterval = setInterval(() => {
        if (clientSocket.readyState === clientSocket.OPEN) {
          clientSocket.ping(); // This keeps the connection alive
        }
      }, 30000); // every 30s
      clientSocket.on('close', () => {
        clearInterval(pingInterval);
        webClients.delete(clientSocket);
        console.log('Client UI disconnected');
        return;
      });
      clientSocket.on('error', (error) => {
        clearInterval(pingInterval);
        console.error('Client UI error:', error);
        webClients.delete(clientSocket);
        return;
      });
    });
  });
}