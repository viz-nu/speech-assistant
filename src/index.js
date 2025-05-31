import { configDotenv } from 'dotenv';
import './utils/connectTodb.js';
configDotenv();
let {
    OPEN_API_KEY,
    PORT,
    NODE_ENV = 'development', // 'production'
} = process.env;

import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import { makeCallUsingTwilio } from './utils/twillio.js';
import { setupWebSocketRoutes } from './services/completeSocketsRoute.js';
import { analyzeConversation } from './utils/openAi.js';
import { CallSession } from './models/sessionData.js';
import { makeCallUsingExotel } from './utils/exotel.js';
import { jsonArrayToHtmlTable } from './utils/Emailer.js';
// Initialize Fastify
const fastify = Fastify({ logger: { level: NODE_ENV === 'production' ? 'info' : "debug" } });
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);
fastify.register(fastifyCors, { origin: true, credentials: true });
fastify.get('/', async (request, reply) => { return { message: 'Twilio Media Stream Server is running!', status: 'healthy', timestamp: new Date().toISOString() }; });
fastify.get('/health', async (request, reply) => { return { status: 'ok', worker: process.pid }; });
// POST endpoint to initiate calls
fastify.post('/call', async (request, reply) => {
    try {
        const { phoneNumber, systemMessage, voice = "ash", miscData } = request.body;
        if (!phoneNumber) return reply.code(400).send({ error: 'Phone number is required', message: 'Please provide a phoneNumber in the request body' });
        // if (!/^\+?1?\d{10,15}$/.test(phoneNumber.replace(/\D/g, ''))) return reply.code(400).send({ error: 'Invalid phone number', message: 'Please provide a valid phone number' });
        const data = { phoneNumber, voice, provider: "openai", telephonyProvider: "twilio", transcripts: [], misc: {}, conclusion: miscData };
        if (systemMessage) data.systemMessage = systemMessage;
        const session = await CallSession.create(data);
        const call = await makeCallUsingTwilio({ to: phoneNumber, _id: session._id });
        const sanitizedCall = JSON.parse(JSON.stringify(call));
        await CallSession.findByIdAndUpdate(session._id, { $set: { callSessionId: call.sid, misc: { twilio: { sanitizedCall } } } });
        // const result = await makeCallUsingExotel(phoneNumber);
        return reply.code(200).send({ success: true, message: `Call initiated to ${phoneNumber}`, data: session });
    } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Internal server error', message: 'Failed to initiate call' });
    }
});
fastify.post('/exotel-call', async (request, reply) => {
    try {
        const { phoneNumber } = request.body;
        // if (!phoneNumber) return reply.code(400).send({ error: 'Phone number is required', message: 'Please provide a phoneNumber in the request body' });
        // // if (!/^\+?1?\d{10,15}$/.test(phoneNumber.replace(/\D/g, ''))) return reply.code(400).send({ error: 'Invalid phone number', message: 'Please provide a valid phone number' });
        // const session = await CallSession.create({ phoneNumber, voice, systemMessage, provider: "openai", transcripts: [], misc: {}, conclusion: miscData });
        // const call = await makeCallUsingTwilio({ to: phoneNumber, _id: session._id });
        // const sanitizedCall = JSON.parse(JSON.stringify(call));
        // await CallSession.findByIdAndUpdate(session._id, { $set: { callSessionId: call.sid, misc: { twilio: { sanitizedCall } } } });
        const result = await makeCallUsingExotel(phoneNumber);
        return reply.code(200).send({ success: true, message: `Call initiated to ${phoneNumber}`, data: session });
    } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: error, message: 'Failed to initiate call' });
    }
});
fastify.get('/call-summary', async (request, reply) => {
    try {
        const { sessionId } = request.query;
        const session = await CallSession.findById(sessionId, "transcripts conclusion concluded");
        if (!session) return reply.code(404).send({ error: 'Session not found', message: 'No session found with the provided ID' });
        if (session.concluded) return reply.code(200).send({ success: true, message: `summary extracted`, data: session.conclusion });
        const summary = await analyzeConversation(session.transcripts, session.conclusion, OPEN_API_KEY);
        await CallSession.findByIdAndUpdate(sessionId, { $set: { conclusion: summary, concluded: true } });
        const html = jsonArrayToHtmlTable(summary);
        const text = summary.map(item => `${item.key.toUpperCase()}:\nDescription: ${item.description}\nType: ${item.type}\nConstraints: ${item.constraints}\nValue: ${typeof item.value === 'object' ? JSON.stringify(item.value, null, 2) : item.value}\n\n`).join('');
        await sendMail({ to: "ankit@onewindow.co", cc: "anurag@onewindow.co", bcc: "vishnu.teja101.vt@gmail.com", subject: "Conclusions derived from conversation in structured format", text, html });
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
// WebSocket endpoint for media streams (if needed)
fastify.register(setupWebSocketRoutes);
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