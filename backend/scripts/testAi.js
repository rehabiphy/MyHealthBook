import 'dotenv/config';
import { complete, llmConfigured } from '../src/utils/llm.js';

/* Sends one harmless test message to the configured AI provider and
   prints the reply. No user or health data is sent.

   Usage (from backend/):
     npm run test:ai                         uses AI_PROVIDER from .env
     AI_PROVIDER=bedrock npm run test:ai     tries Bedrock without changing .env */

const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
console.log(`Provider: ${provider}`);
if (provider === 'bedrock') console.log(`Region: ${process.env.BEDROCK_REGION || process.env.AWS_REGION || '(not set)'}`);
if (provider === 'bedrock') console.log(`Model: ${process.env.BEDROCK_MODEL || 'amazon.nova-pro-v1:0 (default)'}`);

if (!llmConfigured()) {
  console.error('Not configured: set AWS_REGION (for bedrock) or OPENAI_API_KEY (for openai) in .env');
  process.exit(1);
}

try {
  const started = Date.now();
  const reply = await complete({ messages: [{ role: 'user', content: 'Reply with exactly: MyHealthBook AI test OK' }] });
  console.log(`Reply (${Date.now() - started} ms): ${reply}`);

  const json = await complete({
    messages: [{ role: 'user', content: 'Give one short tip for drinking more water.' }],
    jsonSchema: { name: 'tip', schema: { type: 'object', properties: { tip: { type: 'string' } }, required: ['tip'], additionalProperties: false } },
  });
  console.log('JSON reply:', json);
  console.log('All good.');
} catch (err) {
  console.error('Failed:', err.code || '', err.message);
  console.error('The line above starting "Bedrock request failed:" shows the AWS error.');
  process.exit(1);
}
