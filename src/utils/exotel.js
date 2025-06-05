import { configDotenv } from 'dotenv';
import qs from 'qs'
configDotenv();
const { EXOTEL_SID, EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_CALLER_ID, DOMAIN, Subdomain } = process.env;
import axios from 'axios';
export const makeCallUsingExotel = async (session) => {
    try {
        const { phoneNumber, _id } = session;
        const source = "Exotel";
        // const apiUrl = `https://api.exotel.com/v1/Accounts/${EXOTEL_SID}/Calls/connect.json`;
        const apiUrl = `https://${EXOTEL_API_KEY}:${EXOTEL_API_TOKEN}@api.exotel.com/v1/Accounts/${EXOTEL_SID}/Calls/connect.json`;
        const payload = {
            From: phoneNumber,
            Url: `http://my.exotel.com/${EXOTEL_SID}/exoml/start_voice/971421`,
            CallerId: EXOTEL_CALLER_ID,
            TimeLimit: 3600,
            TimeOut: 30,
            Method: 'POST',
            CustomField: `{"sessionId": "${_id}","source": "${source}"}`
        };
        // const base64Token = Buffer.from(`${EXOTEL_API_KEY}:${EXOTEL_API_TOKEN}`).toString('base64');
        const headers = {
            // 'Authorization': `Basic ${base64Token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        };
        const { data } = await axios.post(
            apiUrl,
            qs.stringify(payload), // Convert payload to URL-encoded format
            { headers }
        );
        return data;
    } catch (error) {
        console.error('Error making call:', error.response?.data || error.message);
        throw error;
    }
}