import * as functions from "firebase-functions";
import { z } from "zod";
import { db, Timestamp } from "../utils/admin";
import { COLLECTIONS, tenantCollection } from "../utils/collections";

// Contract extraction schema
const contractExtractionSchema = z.object({
  contractNumber: z.string().optional(),
  title: z.string(),
  customerName: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  totalValue: z.number(),
  currency: z.string().default("BRL"),
  paymentTerms: z.string().optional(),
  lineItems: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().default(1),
      unitPrice: z.number(),
      totalPrice: z.number(),
      recognitionMethod: z.enum(["over_time", "point_in_time"]).optional(),
      deliveryStartDate: z.string().optional(),
      deliveryEndDate: z.string().optional(),
    })
  ),
  performanceObligations: z
    .array(
      z.object({
        description: z.string(),
        allocatedPrice: z.number(),
        recognitionMethod: z.enum(["over_time", "point_in_time"]),
        justification: z.string().optional(),
      })
    )
    .optional(),
});

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

Retorne os dados APENAS em formato JSON válido.`;

// AI Provider call functions
async function callOpenAI(apiKey: string, model: string, pdfText: string) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: CONTRACT_EXTRACTION_PROMPT },
        { role: "user", content: `Analise o seguinte contrato:\n\n${pdfText}` },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${await response.text()}`);
  }

  const result = await response.json();
  return {
    content: result.choices[0]?.message?.content,
    tokensUsed: result.usage?.total_tokens,
  };
}

async function callAnthropic(apiKey: string, model: string, pdfText: string) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `${CONTRACT_EXTRACTION_PROMPT}\n\nAnalise o seguinte contrato:\n\n${pdfText}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${await response.text()}`);
  }

  const result = await response.json();
  return {
    content: result.content[0]?.text,
    tokensUsed: (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0),
  };
}

async function callGoogle(apiKey: string, model: string, pdfText: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${CONTRACT_EXTRACTION_PROMPT}\n\nAnalise o seguinte contrato:\n\n${pdfText}`,
              },
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
    throw new Error(`Google API error: ${await response.text()}`);
  }

  const result = await response.json();
  return {
    content: result.candidates?.[0]?.content?.parts?.[0]?.text,
    tokensUsed: result.usageMetadata?.totalTokenCount,
  };
}

async function callOpenRouter(apiKey: string, model: string, pdfText: string) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "",
      "X-Title": "IFRS 15 Revenue Manager",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: CONTRACT_EXTRACTION_PROMPT },
        { role: "user", content: `Analise o seguinte contrato:\n\n${pdfText}` },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${await response.text()}`);
  }

  const result = await response.json();
  return {
    content: result.choices[0]?.message?.content,
    tokensUsed: result.usage?.total_tokens,
  };
}

// Process AI ingestion job
export const processIngestionJob = functions.firestore
  .document("tenants/{tenantId}/aiIngestionJobs/{jobId}")
  .onCreate(async (snap, context) => {
    const { tenantId, jobId } = context.params;
    const jobData = snap.data();

    console.log(`Processing ingestion job: ${jobId} for tenant: ${tenantId}`);

    const jobRef = snap.ref;

    try {
      // Update status to processing
      await jobRef.update({
        status: "processing",
        processingStartedAt: Timestamp.now(),
        progress: 10,
      });

      // Get AI provider config
      const providerDoc = await db
        .collection(tenantCollection(tenantId, COLLECTIONS.AI_PROVIDER_CONFIGS))
        .doc(jobData.providerId)
        .get();

      if (!providerDoc.exists) {
        throw new Error("AI provider config not found");
      }

      const provider = providerDoc.data()!;
      await jobRef.update({ progress: 20 });

      // Get PDF text (stored in filePath as base64 or text)
      const pdfText = jobData.filePath; // In a real scenario, you'd decode/extract PDF text
      await jobRef.update({ progress: 40 });

      // Call appropriate AI provider
      let result: { content: string; tokensUsed?: number };
      const startTime = Date.now();

      switch (provider.provider) {
        case "openai":
          result = await callOpenAI(provider.apiKey, provider.model, pdfText);
          break;
        case "anthropic":
          result = await callAnthropic(provider.apiKey, provider.model, pdfText);
          break;
        case "google":
          result = await callGoogle(provider.apiKey, provider.model, pdfText);
          break;
        case "openrouter":
          result = await callOpenRouter(provider.apiKey, provider.model, pdfText);
          break;
        default:
          throw new Error(`Unknown provider: ${provider.provider}`);
      }

      await jobRef.update({ progress: 70 });

      // Parse and validate response
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not extract JSON from AI response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const validated = contractExtractionSchema.parse(parsed);

      await jobRef.update({ progress: 85 });

      // Generate confidence scores
      const confidenceScores: Record<string, number> = {
        title: validated.title ? 0.9 : 0.3,
        customerName: validated.customerName ? 0.9 : 0.3,
        startDate: validated.startDate ? 0.85 : 0.2,
        endDate: validated.endDate ? 0.85 : 0.5,
        totalValue: validated.totalValue > 0 ? 0.9 : 0.3,
        lineItems: validated.lineItems.length > 0 ? 0.85 : 0.3,
        performanceObligations:
          validated.performanceObligations && validated.performanceObligations.length > 0 ? 0.85 : 0.5,
      };

      // Save extraction result
      const extractionRef = await db
        .collection(tenantCollection(tenantId, COLLECTIONS.AI_EXTRACTION_RESULTS))
        .add({
          jobId,
          extractedData: validated,
          confidenceScores,
          rawResponse: result.content,
          tokensUsed: result.tokensUsed,
          processingTimeMs: Date.now() - startTime,
          createdAt: Timestamp.now(),
        });

      await jobRef.update({ progress: 95 });

      // Create review task
      await db.collection(tenantCollection(tenantId, COLLECTIONS.AI_REVIEW_TASKS)).add({
        jobId,
        extractionResultId: extractionRef.id,
        status: "pending",
        createdAt: Timestamp.now(),
      });

      // Update job status
      await jobRef.update({
        status: "awaiting_review",
        progress: 100,
        processingCompletedAt: Timestamp.now(),
      });

      // Update provider last used
      await providerDoc.ref.update({
        lastUsedAt: Timestamp.now(),
      });

      console.log(`Ingestion job ${jobId} completed successfully`);
    } catch (error: any) {
      console.error(`Error processing ingestion job ${jobId}:`, error);

      await jobRef.update({
        status: "failed",
        errorMessage: error.message || "Unknown error",
        processingCompletedAt: Timestamp.now(),
      });
    }
  });

// Callable function to approve review and create contract
export const approveReviewAndCreateContract = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const tenantId = context.auth.token.tenantId;
  const userId = context.auth.uid;
  const { reviewTaskId, reviewedData, customerId } = data;

  if (!reviewTaskId || !reviewedData || !customerId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields");
  }

  try {
    // Get review task
    const taskRef = db
      .collection(tenantCollection(tenantId, COLLECTIONS.AI_REVIEW_TASKS))
      .doc(reviewTaskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Review task not found");
    }

    const now = Timestamp.now();

    // Create contract
    const contractRef = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
      .add({
        tenantId,
        customerId,
        contractNumber: reviewedData.contractNumber || `C-${Date.now()}`,
        title: reviewedData.title,
        status: "draft",
        startDate: Timestamp.fromDate(new Date(reviewedData.startDate)),
        endDate: reviewedData.endDate ? Timestamp.fromDate(new Date(reviewedData.endDate)) : null,
        totalValue: reviewedData.totalValue,
        currency: reviewedData.currency || "BRL",
        paymentTerms: reviewedData.paymentTerms,
        createdAt: now,
        updatedAt: now,
      });

    // Create initial contract version
    const versionRef = await db
      .collection(`${contractRef.path}/versions`)
      .add({
        contractId: contractRef.id,
        versionNumber: 1,
        effectiveDate: Timestamp.fromDate(new Date(reviewedData.startDate)),
        totalValue: reviewedData.totalValue,
        isProspective: true,
        createdBy: userId,
        createdAt: now,
      });

    // Create line items
    for (const item of reviewedData.lineItems || []) {
      await db.collection(`${versionRef.path}/lineItems`).add({
        contractVersionId: versionRef.id,
        description: item.description,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        recognitionMethod: item.recognitionMethod || "point_in_time",
        isDistinct: true,
        distinctWithinContext: true,
        deliveryStartDate: item.deliveryStartDate
          ? Timestamp.fromDate(new Date(item.deliveryStartDate))
          : null,
        deliveryEndDate: item.deliveryEndDate
          ? Timestamp.fromDate(new Date(item.deliveryEndDate))
          : null,
        createdAt: now,
      });
    }

    // Create performance obligations
    for (const po of reviewedData.performanceObligations || []) {
      await db.collection(`${versionRef.path}/performanceObligations`).add({
        contractVersionId: versionRef.id,
        description: po.description,
        allocatedPrice: po.allocatedPrice,
        recognitionMethod: po.recognitionMethod,
        justification: po.justification,
        percentComplete: 0,
        recognizedAmount: 0,
        deferredAmount: po.allocatedPrice,
        isSatisfied: false,
        createdAt: now,
      });
    }

    // Update contract with current version
    await contractRef.update({
      currentVersionId: versionRef.id,
    });

    // Update review task
    await taskRef.update({
      status: "approved",
      reviewedData,
      contractId: contractRef.id,
      reviewedAt: now,
      reviewedBy: userId,
    });

    // Update ingestion job
    const taskData = taskDoc.data();
    if (taskData?.jobId) {
      await db
        .collection(tenantCollection(tenantId, COLLECTIONS.AI_INGESTION_JOBS))
        .doc(taskData.jobId)
        .update({
          status: "approved",
        });
    }

    // Create audit log
    await db.collection(tenantCollection(tenantId, COLLECTIONS.AUDIT_LOGS)).add({
      tenantId,
      userId,
      entityType: "contract",
      entityId: contractRef.id,
      action: "create",
      newValue: reviewedData,
      justification: "Created from AI extraction",
      createdAt: now,
    });

    return {
      success: true,
      contractId: contractRef.id,
    };
  } catch (error: any) {
    console.error("Error approving review:", error);
    throw new functions.https.HttpsError("internal", error.message || "Failed to approve review");
  }
});
