/* The one place that talks to an LLM provider. Everything AI-shaped
   (coach replies, assistant intent parsing) goes through `complete()`,
   so swapping OpenAI for another provider means changing only this
   file, not every controller that uses it. */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export class LlmError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // 'not-configured' | 'upstream'
  }
}

/* messages: [{ role: 'system'|'user'|'assistant', content }]
   jsonSchema: optional { name, schema } — when set, the model is forced
   to reply with JSON matching it, and the parsed object is returned
   instead of a string. */
export async function complete({ messages, temperature = 0.6, jsonSchema }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new LlmError('not-configured', 'AI is not configured');

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-nano',
      messages,
      temperature,
      ...(jsonSchema ? { response_format: { type: 'json_schema', json_schema: { ...jsonSchema, strict: true } } } : {}),
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    console.error('LLM request failed:', response.status, errBody);
    throw new LlmError('upstream', 'AI request failed');
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new LlmError('upstream', 'Empty AI response');

  if (!jsonSchema) return content;
  try {
    return JSON.parse(content);
  } catch {
    throw new LlmError('upstream', 'AI returned invalid JSON');
  }
}
