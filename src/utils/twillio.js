// Option 1: Using default import (recommended)
import twilio from 'twilio';
import { configDotenv } from 'dotenv';
configDotenv();
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, PHONE_NUMBER_FROM, DOMAIN } = process.env;
export const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
export const makeCallUsingTwilio = async (session) => {
    try {
        const { to, twiml } = session;
        return call = await client.calls.create({ from: PHONE_NUMBER_FROM, to, twiml });
    } catch (error) {
        console.error('Error making call:', error);
    }
}