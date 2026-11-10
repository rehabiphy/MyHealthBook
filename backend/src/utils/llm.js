import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

/* The one place that talks to an LLM provider. Everything AI-shaped
   (coach replies, insights, assistant intent parsing, health tips,
   report reading) goes through `complete()`.

   AI_PROVIDER picks who answers:
     openai  (default) — OpenAI, needs OPENAI_API_KEY
     bedrock           — Amazon Bedrock (Nova by default; any Bedrock model via BEDROCK_MODEL), using the server's AWS credentials
   Switching back is one .env change and a restart; no app release. */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export class LlmError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // 'not-configured' | 'upstream'
  }
}

const provider = () => ((process.env.AI_PROVIDER || 'openai').toLowerCase() === 'bedrock' ? 'bedrock' : 'openai');

export function llmConfigured() {
  return provider() === 'bedrock' ? Boolean(process.env.BEDROCK_REGION || process.env.AWS_REGION) : Boolean(process.env.OPENAI_API_KEY);
}

/* messages: [{ role: 'system'|'user'|'assistant', content }] — content
   is a string, or an array of parts (text / image_url / file) for a
   message that carries a document. Parts use OpenAI's shape; the
   Bedrock path converts them.
   jsonSchema: optional { name, schema } — when set, the model is forced
   to reply with JSON matching it, and the parsed object is returned
   instead of a string.
   purpose: 'chat' (default) or 'document' — reading an uploaded report
   uses a stronger model. */
export async function complete({ messages, temperature = 0.6, jsonSchema, purpose = 'chat' }) {
  if (!llmConfigured()) throw new LlmError('not-configured', 'AI is not configured');
  const content = provider() === 'bedrock' ? await bedrockComplete({ messages, temperature, jsonSchema, purpose }) : await openaiComplete({ messages, temperature, jsonSchema, purpose });

  if (!jsonSchema) return content;
  try {
    return JSON.parse(content);
  } catch {
    throw new LlmError('upstream', 'AI returned invalid JSON');
  }
}

// ---------- OpenAI ----------

async function openaiComplete({ messages, temperature, jsonSchema, purpose }) {
  const model = purpose === 'document' ? process.env.OPENAI_DOCUMENT_MODEL || 'gpt-4.1-mini' : process.env.OPENAI_MODEL || 'gpt-5.4-nano';
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
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
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new LlmError('upstream', 'Empty AI response');
  return text;
}

// ---------- Amazon Bedrock (Converse API) ----------

/* Converse is Bedrock's one interface for every model it hosts, so the
   same code runs Amazon Nova today and Claude later — only the model
   ID in .env changes. Defaults are Nova models offered in Mumbai. */
const BEDROCK_DEFAULTS = { chat: 'amazon.nova-pro-v1:0', document: 'amazon.nova-pro-v1:0', fallback: 'amazon.nova-lite-v1:0' };

let bedrock = null;
function bedrockClient() {
  // Credentials come from the usual AWS chain (AWS_ACCESS_KEY_ID/SECRET or the EC2 instance role).
  bedrock ||= new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || process.env.AWS_REGION });
  return bedrock;
}

// data:<type>;base64,<data> → { mediaType, bytes }
function parseDataUrl(url) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(url || '');
  return m ? { mediaType: m[1], bytes: Buffer.from(m[2], 'base64') } : null;
}

// Bedrock only allows letters, digits, single spaces, hyphens, () and [] in a document name
const docName = name =>
  (name || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-zA-Z0-9\s\-()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100) || 'report';

function toConverseContent(content) {
  if (typeof content === 'string') return [{ text: content }];
  const files = [];
  const texts = [];
  for (const part of content) {
    if (part.type === 'text') {
      texts.push({ text: part.text });
    } else if (part.type === 'image_url') {
      const img = parseDataUrl(part.image_url?.url);
      if (img) files.push({ image: { format: img.mediaType.split('/')[1].replace('jpg', 'jpeg'), source: { bytes: img.bytes } } });
    } else if (part.type === 'file') {
      const doc = parseDataUrl(part.file?.file_data);
      if (doc) files.push({ document: { format: 'pdf', name: docName(part.file.filename), source: { bytes: doc.bytes } } });
    }
  }
  // files before the text that asks about them
  return [...files, ...texts];
}

// Converse needs turns to alternate user/assistant, starting with user
function toConverseMessages(messages) {
  const turns = [];
  for (const m of messages.filter(m => m.role !== 'system')) {
    const content = toConverseContent(m.content);
    const last = turns[turns.length - 1];
    if (last && last.role === m.role) last.content.push(...content);
    else if (turns.length || m.role === 'user') turns.push({ role: m.role, content });
  }
  return turns;
}

async function bedrockComplete({ messages, temperature, jsonSchema, purpose }) {
  const system = messages.filter(m => m.role === 'system').map(m => ({ text: m.content }));
  const isDoc = purpose === 'document';
  const primary = (isDoc ? process.env.BEDROCK_DOCUMENT_MODEL : process.env.BEDROCK_MODEL) || BEDROCK_DEFAULTS[isDoc ? 'document' : 'chat'];
  const fallback = process.env.BEDROCK_FALLBACK_MODEL || BEDROCK_DEFAULTS.fallback;

  // JSON replies: the model must "call" a tool whose input is the schema; that input is the answer
  const toolName = (jsonSchema?.name || 'answer').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  const request = modelId => ({
    modelId,
    messages: toConverseMessages(messages),
    ...(system.length ? { system } : {}),
    inferenceConfig: { maxTokens: 4096, temperature },
    ...(jsonSchema
      ? { toolConfig: { tools: [{ toolSpec: { name: toolName, description: 'Return the answer in this exact shape.', inputSchema: { json: jsonSchema.schema } } }], toolChoice: { tool: { name: toolName } } } }
      : {}),
  });

  let response;
  try {
    response = await bedrockClient().send(new ConverseCommand(request(primary)));
    if (['content_filtered', 'guardrail_intervened'].includes(response.stopReason)) throw new Error(`declined (${response.stopReason})`);
  } catch (err) {
    // a permissions problem won't be fixed by another model; anything else gets one retry on the fallback
    if (err.name === 'AccessDeniedException' || !fallback || fallback === primary) {
      console.error('Bedrock request failed:', primary, err.name, err.message);
      throw new LlmError('upstream', 'AI request failed');
    }
    console.warn('Bedrock: retrying on fallback model —', primary, err.name, err.message);
    try {
      response = await bedrockClient().send(new ConverseCommand(request(fallback)));
    } catch (err2) {
      console.error('Bedrock request failed:', fallback, err2.name, err2.message);
      throw new LlmError('upstream', 'AI request failed');
    }
  }

  if (['content_filtered', 'guardrail_intervened'].includes(response.stopReason)) throw new LlmError('upstream', 'AI declined the request');
  const blocks = response.output?.message?.content || [];
  if (jsonSchema) {
    const use = blocks.find(b => b.toolUse)?.toolUse;
    if (!use?.input) throw new LlmError('upstream', 'AI returned no JSON');
    return JSON.stringify(use.input);
  }
  const text = blocks
    .filter(b => b.text)
    .map(b => b.text)
    .join('')
    .trim();
  if (!text) throw new LlmError('upstream', 'Empty AI response');
  return text;
}
