import { type AiProviderConfig, contractExtractionSchema, type ContractExtraction } from "@shared/schema";

interface AIResponse {
  success: boolean;
  data?: ContractExtraction;
  error?: string;
  tokensUsed?: number;
  processingTimeMs?: number;
}

const CONTRACT_EXTRACTION_PROMPT = `Você é um especialista em análise de contratos para fins de reconhecimento de receita segundo IFRS 15.

Analise o texto do contrato PDF fornecido e extraia as seguintes informações estruturadas:

1. **Dados do Contrato:**
   - Número do contrato (se disponível)
   - Título ou descrição do contrato
   - Nome do cliente/contratante
   - Data de início
   - Data de término (se aplicável)
   - Valor total do contrato
   - Moeda (padrão: BRL)
   - Condições de pagamento

2. **Itens de Linha (produtos/serviços contratados):**
   Para cada produto ou serviço:
   - Descrição
   - Quantidade
   - Preço unitário
   - Preço total
   - Método de reconhecimento sugerido (over_time ou point_in_time)
   - Datas de entrega/prestação

3. **Obrigações de Desempenho (IFRS 15 Step 2):**
   Identifique obrigações de desempenho distintas:
   - Descrição da obrigação
   - Valor alocado
   - Método de reconhecimento (over_time ou point_in_time)
   - Justificativa para o método

Retorne os dados APENAS em formato JSON válido seguindo este schema:
{
  "contractNumber": "string ou null",
  "title": "string (obrigatório)",
  "customerName": "string (obrigatório)",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD ou null",
  "totalValue": number,
  "currency": "BRL",
  "paymentTerms": "string ou null",
  "lineItems": [
    {
      "description": "string",
      "quantity": number,
      "unitPrice": number,
      "totalPrice": number,
      "recognitionMethod": "over_time" ou "point_in_time",
      "deliveryStartDate": "YYYY-MM-DD ou null",
      "deliveryEndDate": "YYYY-MM-DD ou null"
    }
  ],
  "performanceObligations": [
    {
      "description": "string",
      "allocatedPrice": number,
      "recognitionMethod": "over_time" ou "point_in_time",
      "justification": "string"
    }
  ]
}

IMPORTANTE:
- Retorne APENAS o JSON, sem texto adicional
- Use valores numéricos para preços (não strings)
- Use formato de data ISO (YYYY-MM-DD)
- Se alguma informação não estiver disponível, use null
- Mantenha os valores monetários na moeda original do contrato`;

async function callOpenAI(config: AiProviderConfig, pdfText: string): Promise<AIResponse> {
  const startTime = Date.now();
  
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: CONTRACT_EXTRACTION_PROMPT },
          { role: "user", content: `Analise o seguinte contrato e extraia os dados estruturados:\n\n${pdfText}` },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `OpenAI API error: ${error}` };
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;
    
    if (!content) {
      return { success: false, error: "No response from OpenAI" };
    }

    const parsed = JSON.parse(content);
    const validated = contractExtractionSchema.parse(parsed);

    return {
      success: true,
      data: validated,
      tokensUsed: result.usage?.total_tokens,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return { success: false, error: `OpenAI error: ${error}` };
  }
}

async function callAnthropic(config: AiProviderConfig, pdfText: string): Promise<AIResponse> {
  const startTime = Date.now();
  
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 4096,
        messages: [
          { role: "user", content: `${CONTRACT_EXTRACTION_PROMPT}\n\nAnalise o seguinte contrato e extraia os dados estruturados:\n\n${pdfText}` },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Anthropic API error: ${error}` };
    }

    const result = await response.json();
    const content = result.content[0]?.text;
    
    if (!content) {
      return { success: false, error: "No response from Anthropic" };
    }

    // Extract JSON from response (Claude may include text around it)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: "Could not parse JSON from Anthropic response" };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = contractExtractionSchema.parse(parsed);

    return {
      success: true,
      data: validated,
      tokensUsed: result.usage?.input_tokens + result.usage?.output_tokens,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return { success: false, error: `Anthropic error: ${error}` };
  }
}

async function callOpenRouter(config: AiProviderConfig, pdfText: string): Promise<AIResponse> {
  const startTime = Date.now();
  
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ifrs15-manager.replit.app",
        "X-Title": "IFRS 15 Revenue Manager",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: CONTRACT_EXTRACTION_PROMPT },
          { role: "user", content: `Analise o seguinte contrato e extraia os dados estruturados:\n\n${pdfText}` },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `OpenRouter API error: ${error}` };
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;
    
    if (!content) {
      return { success: false, error: "No response from OpenRouter" };
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: "Could not parse JSON from OpenRouter response" };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = contractExtractionSchema.parse(parsed);

    return {
      success: true,
      data: validated,
      tokensUsed: result.usage?.total_tokens,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return { success: false, error: `OpenRouter error: ${error}` };
  }
}

async function callGoogle(config: AiProviderConfig, pdfText: string): Promise<AIResponse> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: `${CONTRACT_EXTRACTION_PROMPT}\n\nAnalise o seguinte contrato e extraia os dados estruturados:\n\n${pdfText}` },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Google API error: ${error}` };
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      return { success: false, error: "No response from Google" };
    }

    const parsed = JSON.parse(content);
    const validated = contractExtractionSchema.parse(parsed);

    return {
      success: true,
      data: validated,
      tokensUsed: result.usageMetadata?.totalTokenCount,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return { success: false, error: `Google error: ${error}` };
  }
}

export async function extractContractData(config: AiProviderConfig, pdfText: string): Promise<AIResponse> {
  switch (config.provider) {
    case "openai":
      return callOpenAI(config, pdfText);
    case "anthropic":
      return callAnthropic(config, pdfText);
    case "openrouter":
      return callOpenRouter(config, pdfText);
    case "google":
      return callGoogle(config, pdfText);
    default:
      return { success: false, error: `Unknown provider: ${config.provider}` };
  }
}

export function generateConfidenceScores(data: ContractExtraction): Record<string, number> {
  const scores: Record<string, number> = {};
  
  // Basic field confidence based on presence
  scores.title = data.title ? 0.9 : 0.3;
  scores.customerName = data.customerName ? 0.9 : 0.3;
  scores.startDate = data.startDate ? 0.85 : 0.2;
  scores.endDate = data.endDate ? 0.85 : 0.5;
  scores.totalValue = data.totalValue > 0 ? 0.9 : 0.3;
  scores.contractNumber = data.contractNumber ? 0.95 : 0.5;
  scores.paymentTerms = data.paymentTerms ? 0.8 : 0.5;
  
  // Line items confidence
  if (data.lineItems.length > 0) {
    const avgLineItemConfidence = data.lineItems.reduce((acc, item) => {
      let confidence = 0.7;
      if (item.description && item.description.length > 10) confidence += 0.1;
      if (item.totalPrice > 0) confidence += 0.1;
      if (item.recognitionMethod) confidence += 0.05;
      return acc + confidence;
    }, 0) / data.lineItems.length;
    scores.lineItems = Math.min(avgLineItemConfidence, 0.95);
  } else {
    scores.lineItems = 0.3;
  }
  
  // Performance obligations confidence
  if (data.performanceObligations && data.performanceObligations.length > 0) {
    scores.performanceObligations = 0.85;
  } else {
    scores.performanceObligations = 0.5;
  }
  
  return scores;
}
