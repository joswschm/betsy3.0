import { NextRequest } from 'next/server';
import { getAnthropicClient } from '@/lib/llm/client';
import { buildDataContext } from '@/lib/llm/context';

export const maxDuration = 30;

const SYSTEM_PROMPT = `You are Betsy's commission tracking assistant. You help her understand her sales performance across multiple furniture factory partnerships (HAT, MG, DARRAN, SYMPHONY).

You have access to her extracted commission data. When answering questions:
- Be specific with dollar amounts and percentages
- Cite which factory the data comes from when relevant
- If data is missing or insufficient, say so clearly
- Keep responses concise and friendly
- Format currency as $X,XXX.XX

If Betsy asks about something not in the data, let her know and suggest what reports she might need to upload.`;

export async function POST(request: NextRequest) {
  try {
    const { message, period } = await request.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const anthropic = getAnthropicClient();
    const dataContext = await buildDataContext(period || undefined);

    const userMessage = `Here is my current commission data:\n\n${dataContext}\n\n---\nMy question: ${message}`;

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    // Stream the response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chat request failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
