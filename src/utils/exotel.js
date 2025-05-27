import { configDotenv } from 'dotenv';
configDotenv();
const { EXOTEL_SID, EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_CALLER_ID, BASE_URL,Subdomain } = process.env;
import axios from 'axios';
export const makeCallUsingExotel = async (phoneNumber) => {
    try {
        const { data } = await axios.post(
            `https://${EXOTEL_API_KEY}:${EXOTEL_API_TOKEN}${Subdomain}/v1/Accounts/${EXOTEL_SID}/Calls/connect`,
            {
                From: EXOTEL_CALLER_ID,
                To: phoneNumber,
                CallerId: EXOTEL_CALLER_ID,
                CallType: 'trans',
                Url: `${BASE_URL}/media-stream`,
                StatusCallback: `${BASE_URL}/call-status`,
                Method: 'POST'
            }
        );

        return data;
    } catch (error) {
        console.error('Error making call:', error);
        throw error;
    }
}
