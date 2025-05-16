import axios from 'axios';

export const analyzeConversation = async (conversation, apiKey) => {
    const systemPrompt = `You are a smart assistant that analyzes student conversations with an education advisor. Extract relevant information from the conversation and return a structured JSON output.
Return this format:
{
  "name": "Full name if mentioned",
  "budget": "Budget range or value if mentioned",
  "interest_score": "Rate the student's interest in studying abroad from 0-10 based on intent, enthusiasm, and follow-ups",
  "preferred_course": "Student's preferred course or subject area",
  "preferred_country": "Target country or destination",
  "intake": "Target intake month and year, or just year",
  "education_level": "Highest level of education completed or ongoing (e.g., High School, Bachelor's, Master's)",
  "academic_background": "Any grades, marks, subjects studied relevant to the preferred course",
  "test_scores": {
    "language_proficiency": "Details of IELTS, TOEFL, Duolingo, etc. if given",
    "aptitude_tests": "Details of GRE, GMAT, SAT, etc. if given"
  },
  "next_meeting": "Proposed or confirmed next meeting time or slot"
}
If any detail is missing, return "Not mentioned".`;
    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4.1-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `${conversation}` }
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
