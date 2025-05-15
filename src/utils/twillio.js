// Option 1: Using default import (recommended)
import twilio from 'twilio';
import { configDotenv } from 'dotenv';
configDotenv();
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,PHONE_NUMBER_FROM,DOMAIN } = process.env;
export const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
export const makeCall = async (to) => {
    try {
        const outboundTwiML = `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="wss://${DOMAIN.replace(/(^\w+:|^)\/\//, '').replace(/\/+$/, '')}/media-stream" /></Connect></Response>`;
        const call = await client.calls.create({ from: PHONE_NUMBER_FROM, to, twiml: outboundTwiML });
        console.log(`Call started with SID: ${call.sid}`);
    } catch (error) {
        console.error('Error making call:', error);
    }
}