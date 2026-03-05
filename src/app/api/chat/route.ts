import { NextRequest } from 'next/server';
import { getAnthropicClient } from '@/lib/llm/client';
import { buildDataContext } from '@/lib/llm/context';

export const maxDuration = 30;

const SYSTEM_PROMPTS: Record<string, string> = {
  casual: `You are Betsy's friendly commission tracking assistant. You help her understand her sales performance across furniture factory partnerships (HAT, MG, DARRAN, SYMPHONY, Carnegie, WIT).

When answering:
- Be warm, conversational and encouraging
- Use plain language, avoid jargon
- Celebrate wins and highlight positive trends
- Be specific with dollar amounts (format as $X,XXX.XX)
- Keep answers concise and easy to read
- If data is missing, say so simply and suggest next steps`,

  professional: `You are a professional sales analytics assistant tracking commission performance across furniture factory partnerships (HAT, MG, DARRAN, SYMPHONY, Carnegie, WIT).

When answering:
- Be precise, formal and data-driven
- Lead with key metrics and percentages
- Use structured formatting where helpful
- Format all currency as $X,XXX.XX
- Reference factory names explicitly when relevant
- If data is insufficient, state exactly what is missing`,
};

export async function POST(request: NextRequest) {
  try {
    const { message, period, tone = 'casual' } = await request.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const anthropic = getAnthropicClient();
    const dataContext = await buildDataContext(period || undefined);

    const userMessage = `Here is my current commission data:\n\n${dataContext}\n\n---\nMy question: ${message}`;

    const systemPrompt = SYSTEM_PROMPTS[tone] || SYSTEM_PROMPTS.casual;

    const stream = await anthropic.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
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
