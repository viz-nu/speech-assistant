// Option 1: Using default import (recommended)
import twilio from 'twilio';
import { configDotenv } from 'dotenv';
configDotenv();
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, PHONE_NUMBER_FROM, DOMAIN } = process.env;
export const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
export const makeCallUsingTwilio = async (session) => {
    try {
        const { to, _id } = session;
        const VoiceResponse = twilio.twiml.VoiceResponse;
        const response = new VoiceResponse();
        const connect = response.connect();
        const stream = connect.stream({ url: `wss://${DOMAIN.replace(/^https?:\/\//, '')}/media-stream` });
        stream.parameter({ name: 'sessionId', value: _id.toString() });
        const twiml = response.toString();
        return await client.calls.create({ from: PHONE_NUMBER_FROM, to, twiml });
    } catch (error) {
        console.error('Error making call:', error);
        throw error;
    }
}
export async function listAvailableNumbers({ isoCountry, capabilities, types, searchType, searchFilter }) {
    const result = [];
    for (const type of types) {
        const listType = type.toLowerCase(); // local, tollfree
        try {
            
            const numbers = await client.availablePhoneNumbers(isoCountry)[listType].list({ limit: 5 });
            result.push(...numbers.filter(number => { return capabilities.every(cap => { return number.capabilities?.[cap.toLowerCase()] === true; }); }))
        } catch (err) {
            console.error(`Error fetching ${type} numbers in ${isoCountry}:`, err.message);
        }
    }
    return result;
}
export const cutTheCallUsingTwilio = async (callSid) => {
    try {
        await client.calls(callSid).update({ status: 'completed' });
    } catch (error) {
        console.error('Error cutting the call:', error);
        throw error;
    }
}
export const cutTheCall = async (callSid, telephonyProvider = 'twilio') => {
    switch (telephonyProvider) {
        case 'twilio':
            await cutTheCallUsingTwilio(callSid);
            break;
        case 'exotel':
            break;
        default:
            throw new Error('Unsupported telephony provider');
    }
}