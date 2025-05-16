import { configDotenv } from 'dotenv';
configDotenv();
let {
    // OPEN_API_KEY, 
    PORT,
    NODE_ENV = 'development', // 'production'
} = process.env;

// Initialize the Twilio library and set our outgoing call TwiML

import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import { makeCallUsingTwilio } from './utils/twillio.js';
import { setupWebSocketRoutes } from './utils/completeSocketsRoute.js';
// Initialize Fastify
// NODE_ENV === 'production' ? 'info' :"debug"
const fastify = Fastify({ logger: { level: "info" } });
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);
fastify.register(fastifyCors, { origin: true, credentials: true });
fastify.get('/', async (request, reply) => { return { message: 'Twilio Media Stream Server is running!', status: 'healthy', timestamp: new Date().toISOString() }; });
fastify.get('/health', async (request, reply) => { return { status: 'ok', worker: process.pid }; });

// POST endpoint to initiate calls
fastify.post('/call', async (request, reply) => {
    try {
        const { phoneNumber } = request.body;
        if (!phoneNumber) return reply.code(400).send({ error: 'Phone number is required', message: 'Please provide a phoneNumber in the request body' });
        // if (!/^\+?1?\d{10,15}$/.test(phoneNumber.replace(/\D/g, ''))) return reply.code(400).send({ error: 'Invalid phone number', message: 'Please provide a valid phone number' });
        // Make the call
        const result = await makeCallUsingTwilio(phoneNumber);
        // const result = await makeCallUsingExotel(phoneNumber);
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