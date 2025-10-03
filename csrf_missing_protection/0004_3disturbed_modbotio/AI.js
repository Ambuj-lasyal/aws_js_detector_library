import axios from 'axios';

export default class AI {
  constructor(apiConfig) {
    this.apiConfig = apiConfig; // Contains endpoint and API key
  }

  async sendPrompt(prompt) {
    try {
      const { endpoint, apiKey, model } = this.apiConfig;

      // Prepare the payload for OpenAI API or LLaMA server
      const payload = {
        model: model || 'llama3.2', // Default to ChatGPT
        prompt,
        max_tokens: 20000, // Adjust as needed
        temperature: 0.7,
        stream: false,
      };

      const headers = {
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await axios.post(endpoint, payload, { headers });

      // Return the generated text from the AI
      return response.data;
    } catch (error) {
      console.error('Error communicating with AI endpoint:', error);
      throw new Error('Failed to get response from AI.');
    }
  }
}