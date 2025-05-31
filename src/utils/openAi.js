import axios from 'axios';

export const analyzeConversation = async (conversation, schema, apiKey) => {
    const generateSchema = (conclusionArray) => {
        const properties = {};
        conclusionArray.forEach(item => {
            properties[item.key] = {
                type: item.type === 'string' ? 'string' :
                    item.type === 'number' ? 'number' :
                        item.type === 'boolean' ? 'boolean' :
                            item.type === 'array' ? 'array' : 'string',
                description: item.description
            };

            // Add array item type if it's an array
            if (item.type === 'array' && item.items) {
                properties[item.key].items = { type: item.items };
            }
        });

        return {
            type: "object",
            properties: properties,
            required: conclusionArray.map(item => item.key),
            additionalProperties: false
        };
    };
    const systemPrompt = `You are a smart assistant that analyzes conversations between a client and a service provider voice-bot. Extract relevant information from the conversation and return it in the structured JSON format.
For each field in the response:
${schema?.map(item => `- ${item.key}: ${item.description} (${item.type}${item.constraints ? `, ${item.constraints}` : ''})`).join('\n')}
If any detail is missing in the conversation, set the value to "Not mentioned".
Current date: ${new Date().toISOString()}`;
    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o-mini', // Fixed model name
                messages: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: conversation.map(ele => `${ele.speaker}: ${ele.message}`).join("\n")
                    }
                ],
                temperature: 0.1, // Lower temperature for more consistent output
                response_format: {
                    type: "json_schema",
                    json_schema: {
                        name: "conversation_analysis",
                        description: "Structured analysis of client-service provider conversation",
                        schema: generateSchema(schema),
                        strict: true
                    }
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        const output = response.data.choices[0].message.content.trim();
        const parsedOutput = JSON.parse(output);
        // Validate that all expected keys are present
        const expectedKeys = schema.map(item => item.key);
        const returnedKeys = Object.keys(parsedOutput);

        if (!expectedKeys.every(key => returnedKeys.includes(key))) {
            console.warn('Some expected keys are missing from the response');
        }

        return parsedOutput;

    } catch (error) {
        console.error('Error analyzing conversation:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });

        // Return fallback structure with "Not mentioned" values
        const fallbackResponse = {};
        schema.forEach(item => {
            fallbackResponse[item.key] = "Not mentioned";
        });

        return fallbackResponse;
    }
}
