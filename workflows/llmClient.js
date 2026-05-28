import { appConfig } from '../config/appConfig';

function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((p) => p?.text || '').join('').trim();
}

async function callGemini({ apiKey, model, systemPrompt, userPrompt, temperature, maxTokens }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini ${response.status}: ${err.slice(0, 240)}`);
  }

  const data = await response.json();
  const content = extractGeminiText(data);
  if (!content) throw new Error('Gemini returned empty content');
  return content;
}

async function callOpenAI({ apiKey, model, systemPrompt, userPrompt, temperature, maxTokens }) {
  const response = await fetch(appConfig.openai.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI ${response.status}: ${err.slice(0, 240)}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '';
  if (!content) throw new Error('OpenAI returned empty content');
  return content;
}

export async function callLlmWithFallback(
  {
    systemPrompt,
    userPrompt,
    temperature = 0.05,
    maxTokens = 12000,
  },
  onProviderEvent
) {
  const providers = appConfig.llm?.providers || ['gemini', 'openai'];
  const errors = [];

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const isFallback = i > 0;
    onProviderEvent?.({ stage: 'attempt', provider, isFallback });
    try {
      if (provider === 'gemini') {
        const key = appConfig.llm?.gemini?.getApiKey?.();
        if (!key) throw new Error('Gemini API key missing');
        const content = await callGemini({
          apiKey: key,
          model: appConfig.llm?.gemini?.model || 'gemini-2.5-flash',
          systemPrompt,
          userPrompt,
          temperature,
          maxTokens,
        });
        onProviderEvent?.({ stage: 'success', provider, isFallback });
        return { provider, content, attemptedProviders: providers.slice(0, i + 1) };
      }

      if (provider === 'openai') {
        const key = appConfig.openai?.getApiKey?.();
        if (!key) throw new Error('OpenAI API key missing');
        const content = await callOpenAI({
          apiKey: key,
          model: appConfig.openai?.model || 'gpt-4o-mini',
          systemPrompt,
          userPrompt,
          temperature,
          maxTokens,
        });
        onProviderEvent?.({ stage: 'success', provider, isFallback });
        return { provider, content, attemptedProviders: providers.slice(0, i + 1) };
      }

      throw new Error(`Unsupported provider: ${provider}`);
    } catch (error) {
      const message = error?.message || String(error);
      errors.push({ provider, message });
      onProviderEvent?.({ stage: 'failure', provider, isFallback, message });
    }
  }

  const formatted = errors.map((e) => `${e.provider}: ${e.message}`).join(' | ');
  throw new Error(`LLM providers failed. ${formatted}`);
}
