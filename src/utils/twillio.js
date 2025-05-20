// Option 1: Using default import (recommended)
import twilio from 'twilio';
import { configDotenv } from 'dotenv';
configDotenv();
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, PHONE_NUMBER_FROM, DOMAIN } = process.env;
export const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
export const makeCallUsingTwilio = async (session) => {
    try {
        const { to, _id } = session;
        // ✅ Construct TwiML using Twilio helper
        const VoiceResponse = twilio.twiml.VoiceResponse;
        const response = new VoiceResponse();
        const connect = response.connect();
        const stream = connect.stream({ url: `wss://${DOMAIN.replace(/^https?:\/\//, '')}/media-stream` });
        // ✅ Add sessionId explicitly as a parameter
        stream.parameter({ name: 'sessionId', value: _id.toString() });
        const twiml = response.toString();
        console.log('✅ Final TwiML being sent to Twilio:\n', twiml);
        // ✅ Make the call
        return await client.calls.create({ from: PHONE_NUMBER_FROM, to, twiml });
    } catch (error) {
        console.error('Error making call:', error);
        throw error;
    }
}