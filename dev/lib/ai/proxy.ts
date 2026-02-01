import { streamText } from 'ai';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
import { getOpenAIModel } from './providers/openai';
import { getAnthropicModel } from './providers/anthropic';
import { callCloudflareAI, streamCloudflareAI } from './providers/cloudflare';
import { getModelPricing, calculateCost, type ModelProvider } from './pricing';
import { countMessageTokens } from './tokens';

export interface ProxyRequest {
  model: string;
  messages: Message[];
  attemptId?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ProxyResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  model: string;
}

export function getProvider(model: string): ModelProvider {
  const pricing = getModelPricing(model);
  if (!pricing) {
    throw new Error(`Unknown model: ${model}`);
  }
  return pricing.provider;
}

export async function callAI(request: ProxyRequest): Promise<ProxyResponse> {
  const { model, messages, maxTokens = 4096, temperature = 0.7 } = request;
  const provider = getProvider(model);

  if (provider === 'cloudflare') {
    // Cloudflare uses a different message format
    const cfMessages = messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }));

    const result = await callCloudflareAI(model, cfMessages, { maxTokens, temperature });
    const cost = calculateCost(model, result.inputTokens, result.outputTokens);

    return {
      content: result.content,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cost,
      model,
    };
  }

  // OpenAI or Anthropic via Vercel AI SDK
  const aiModel = provider === 'openai' ? getOpenAIModel(model) : getAnthropicModel(model);

  const result = await streamText({
    model: aiModel,
    messages,
    maxOutputTokens: maxTokens,
    temperature,
  });

  // Collect the full response
  let content = '';
  for await (const chunk of result.textStream) {
    content += chunk;
  }

  const usage = await result.usage;
  const inputTokens = usage?.inputTokens || countMessageTokens(messages.map(m => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
  })));
  const outputTokens = usage?.outputTokens || Math.ceil(content.length / 4);
  const cost = calculateCost(model, inputTokens, outputTokens);

  return {
    content,
    inputTokens,
    outputTokens,
    cost,
    model,
  };
}

export async function* streamAI(request: ProxyRequest): AsyncGenerator<string, ProxyResponse> {
  const { model, messages, maxTokens = 4096, temperature = 0.7 } = request;
  const provider = getProvider(model);

  if (provider === 'cloudflare') {
    const cfMessages = messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }));

    const generator = streamCloudflareAI(model, cfMessages, { maxTokens, temperature });
    let result;
    
    while (true) {
      const { value, done } = await generator.next();
      if (done) {
        result = value;
        break;
      }
      yield value;
    }

    const cost = calculateCost(model, result.inputTokens, result.outputTokens);
    return {
      content: '', // Already streamed
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cost,
      model,
    };
  }

  // OpenAI or Anthropic
  const aiModel = provider === 'openai' ? getOpenAIModel(model) : getAnthropicModel(model);

  const result = await streamText({
    model: aiModel,
    messages,
    maxOutputTokens: maxTokens,
    temperature,
  });

  let content = '';
  for await (const chunk of result.textStream) {
    content += chunk;
    yield chunk;
  }

  const usage = await result.usage;
  const inputTokens = usage?.inputTokens || countMessageTokens(messages.map(m => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
  })));
  const outputTokens = usage?.outputTokens || Math.ceil(content.length / 4);
  const cost = calculateCost(model, inputTokens, outputTokens);

  return {
    content,
    inputTokens,
    outputTokens,
    cost,
    model,
  };
}
