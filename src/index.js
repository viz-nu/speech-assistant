import { configDotenv } from 'dotenv';
import './utils/connectTodb.js';
configDotenv();
let {
    OPEN_API_KEY,
    PORT, DOMAIN,
    NODE_ENV = 'development', // 'production'
} = process.env;
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import multipart from '@fastify/multipart';
import { makeCallUsingTwilio } from './utils/twillio.js';
import { setupWebSocketRoutes } from './services/completeSocketsRoute.js';
import { analyzeConversation } from './utils/openAi.js';
import { CallSession } from './models/sessionData.js';
import { makeCallUsingExotel } from './utils/exotel.js';
import { jsonArrayToHtmlTable, sendMail } from './utils/Emailer.js';
// Initialize Fastify
const fastify = Fastify({ logger: { level: NODE_ENV === 'production' ? 'info' : "debug" } });
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);
fastify.register(fastifyCors, { origin: true, credentials: true });
fastify.get('/', async (request, reply) => { return { message: 'Twilio Media Stream Server is running!', status: 'healthy', timestamp: new Date().toISOString() }; });
fastify.get('/health', async (request, reply) => { return { status: 'ok', worker: process.pid }; });
// WebSocket endpoint for media streams (if needed)
fastify.register(setupWebSocketRoutes);
fastify.register(multipart);
fastify.post('/call', async (request, reply) => {
    try {
        const { phoneNumber, systemMessage, voice = "ash", miscData = [], telephonyProvider = "exotel" } = request.body;
        if (!phoneNumber) return reply.code(400).send({ error: 'Phone number is required', message: 'Please provide a phoneNumber in the request body' });
        const data = { phoneNumber, voice, provider: "openai", telephonyProvider: telephonyProvider, transcripts: [], misc: {}, conclusion: miscData };
        if (systemMessage) data.systemMessage = systemMessage;
        let session = await CallSession.create(data);
        switch (telephonyProvider) {
            case 'twilio':
                const call = await makeCallUsingTwilio({ to: phoneNumber, _id: session._id });
                const sanitizedCall = JSON.parse(JSON.stringify(call));
                session = await CallSession.findByIdAndUpdate(session._id, { $set: { callSessionId: call.sid, misc: { twilio: { sanitizedCall } } } }, { new: true });
                break;
            case 'exotel':
                const result = await makeCallUsingExotel({ phoneNumber, _id: session._id });
                session = await CallSession.findByIdAndUpdate(session._id, { $set: { callSessionId: result.Call.Sid, misc: { exotel: { result } } } }, { new: true });
                break;
            default:
                return reply.code(400).send({ error: 'Invalid telephony provider', message: 'Supported providers are twilio and exotel' });
        }
        return reply.code(200).send({ success: true, message: `Call initiated to ${phoneNumber}`, data: session });
    } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Internal server error', message: 'Failed to initiate call' });
    }
});
fastify.get('/call-summary', async (request, reply) => {
    try {
        const { sessionId } = request.query;
        const session = await CallSession.findById(sessionId, "transcripts conclusion concluded phoneNumber");
        if (!session) return reply.code(404).send({ error: 'Session not found', message: 'No session found with the provided ID' });
        if (session.concluded) return reply.code(200).send({ success: true, message: `summary extracted`, data: session.conclusion });
        const schema = session.conclusion; // assuming schema was stored here
        if (!Array.isArray(schema)) return reply.code(500).send({ error: 'Schema format invalid', message: 'Expected conclusion to be an array schema before processing' });
        const summary = await analyzeConversation(session.transcripts, session.conclusion, OPEN_API_KEY);
        await CallSession.findByIdAndUpdate(sessionId, { $set: { conclusion: summary, concluded: true } });
        const html = jsonArrayToHtmlTable(summary);
        const text = summary.map(item => `${item.key.toUpperCase()}:\nDescription: ${item.description}\nType: ${item.type}\nConstraints: ${item.constraints}\nValue: ${typeof item.value === 'object' ? JSON.stringify(item.value, null, 2) : item.value}\n\n`).join('');
        sendMail({ to: "ankit@onewindow.co", cc: "anurag@onewindow.co", bcc: "vishnu.teja101.vt@gmail.com", subject: `Conclusions derived from conversation in structured format Phone:${session.phoneNumber}`, text, html });
        return reply.code(200).send({ success: true, message: `summary extracted`, data: summary });
    } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Internal server error', message: 'Failed to initiate call' });
    }
}
);
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

fastify.get("/get-websocket", async (request, reply) => {
    try {
        const { sessionId, source } = JSON.parse(request.query.CustomField)
        const queryParams = new URLSearchParams({ sessionId, source: source || 'unknown' });
        return reply.type('application/json').send({ url: `wss://${DOMAIN.replace(/^https?:\/\//, '')}/media-stream?${queryParams.toString()}` });
    } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Internal server error', message: 'Failed to retrieve WebSocket URL' });
    }
});

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