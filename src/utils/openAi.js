import axios from 'axios';

export const analyzeConversation = async (conversation, conclusion, apiKey) => {
    const systemPrompt = `You are a smart assistant that analyzes conversations between a client and a service provider voice-bot. Extract relevant information from the conversation and return it in a structured JSON format.
Use the following format. Do not change the "key", "description", "type", or "constraints"—only populate the "value" field based on the conversation:
${conclusion}
If any detail is missing in the conversation, set the "value" to "Not mentioned". Date: ${new Date()}`;
    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4.1-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `${conversation.map(ele => `${ele.speaker}:${ele.message}`).join("\n")}` }
                ],
                temperature: 0.2
            },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        const output = response.data.choices[0].message.content.trim();
        return JSON.parse(output);
    } catch (error) {
        console.error('Error analyzing conversation:', error.response?.data || error.message);
        return null;
    }
}
