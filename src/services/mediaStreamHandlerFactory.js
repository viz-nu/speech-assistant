// const OpenAIMediaStreamHandler = require('./openaiMediaStream');
// const DeepgramMediaStreamHandler = require('./deepgramMediaStream');
// const GroqMediaStreamHandler = require('./groqMediaStream');

import { CallSession } from "../models/sessionData.js";
import { OpenAIMediaStreamHandler } from "../utils/openaiMediaStream.js";
import { configDotenv } from 'dotenv';
configDotenv();
const providerConfigs = {
    openai: {
        callSessionId: "",
        apiKey: process.env.OPEN_API_KEY,
        voice: 'ash',
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


export class MediaStreamHandlerFactory {
    static create(provider, config) {
        switch (provider) {
            case 'openai':
                return new OpenAIMediaStreamHandler(config);
            // case 'deepgram':
            //     return new DeepgramMediaStreamHandler(config);
            // case 'groq':
            //     return new GroqMediaStreamHandler(config);
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
    }
}


export const initiateConnectionBetweenUserAndProvider = async (config) => {
    try {
        const { sessionId, connection } = config;
        const session = await CallSession.findById(sessionId);
        if (!session) {
            console.error(`Session with ID ${sessionId} not found`);
            return { status: false, message: 'Session not found' };
        }
        handler = MediaStreamHandlerFactory.create(session.provider, {
            ...providerConfigs[provider],
            welcomeMessage: session.welcomeMessage,
            callSessionId: session.callSessionId,
            voice: session.voice || providerConfigs[provider].voice,
            systemMessage: session.systemMessage || providerConfigs[provider].systemMessage,
            streamSid: parsed.start.streamSid
        });
        await handler.connect(connection);
        session.status = "active"
        session.save();
        return {
            status: true,
            message: `Connection initiated between user and ${session.provider} provider`,
            mediaHandler: handler
        };
    } catch (error) {
        console.error(error);
        return { status: false, message: error.message || 'Failed to initiate connection' };

    }
}
