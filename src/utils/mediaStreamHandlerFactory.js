// const OpenAIMediaStreamHandler = require('./openaiMediaStream');
// const DeepgramMediaStreamHandler = require('./deepgramMediaStream');
// const GroqMediaStreamHandler = require('./groqMediaStream');

import { OpenAIMediaStreamHandler } from "./openaiMediaStream.js";

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