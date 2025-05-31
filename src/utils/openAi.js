import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
const fallbackSchema = [
    { key: "intent", description: "User's intent", type: "string" },
    { key: "urgency", description: "How urgent is the request", type: "string" },
    { key: "client_name", description: "Name of the client", type: "string" },
    { key: "topics", description: "Main topics discussed", type: "array", items: "string" }
];

/**
 * Convert custom JSON schema to a Zod schema
 */
const toZodSchema = (schemaArray) => {
    const shape = {};
    for (const item of schemaArray) {
        let baseType;
        switch (item.type) {
            case "string":
                baseType = z.string();
                break;
            case "number":
                baseType = z.number();
                break;
            case "boolean":
                baseType = z.boolean();
                break;
            case "array":
                baseType = z.array(z[item.items] ? z[item.items]() : z.string());
                break;
            default:
                baseType = z.string();
        }
        shape[item.key] = baseType.describe(item.description || "");
    }
    return z.object(shape);
};
/**
 * Analyze conversation and return structured output
 */
export const analyzeConversation = async (conversation, schema = [], apiKey) => {
    const effectiveSchema = Array.isArray(schema) && schema.length ? schema : fallbackSchema;
    const zodSchema = toZodSchema(effectiveSchema);

    const systemPrompt = `You are a smart assistant that extracts structured information from conversations.
Your task is to return the following fields:
${effectiveSchema.map(item => `- ${item.key}: ${item.description} (${item.type})`).join('\n')}
If something is not mentioned, write "Not mentioned".`;

    const userMessage = conversation.map(
        ele => `${ele.speaker}: ${ele.message}`
    ).join('\n');

    try {
        const openai = new OpenAI({ apiKey });

        const response = await openai.responses.parse({
            model: 'gpt-4o-mini',
            input: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage }
            ],
            text: {
                format: zodTextFormat(zodSchema, "conversation_summary")
            }
        });

        const output = response.output_parsed;

        // Reconstruct data in unified shape
        const structured = effectiveSchema.map(item => ({
            key: item.key,
            description: item.description,
            type: item.type,
            constraints: item.constraints || "",
            value: output[item.key] ?? "Not mentioned"
        }));

        return structured;

    } catch (err) {
        console.error("Error analyzing conversation:", {
            message: err.message,
            cause: err.cause
        });

        // Fallback values
        return effectiveSchema.map(item => ({
            key: item.key,
            description: item.description,
            type: item.type,
            constraints: item.constraints || "",
            value: "Not mentioned"
        }));
    }
};
