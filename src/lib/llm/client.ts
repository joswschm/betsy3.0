import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === 'sk-ant-your-key-here') {
      throw new Error('ANTHROPIC_API_KEY is not configured. Add it to .env.local');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}
