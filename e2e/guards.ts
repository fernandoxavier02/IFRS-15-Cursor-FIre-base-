import type { Page } from "@playwright/test";

/**
 * Coleção de erros capturados durante a navegação
 */
export interface ErrorCollection {
  consoleErrors: string[];
  pageErrors: Error[];
  failedRequests: { url: string; failureText: string }[];
  badResponses: { url: string; status: number }[];
  api404s: { url: string }[];
}

/**
 * Anexa guards (listeners) à página para capturar erros
 * 
 * Captura:
 * - console.error
 * - Exceções JavaScript (pageerror)
 * - Requests falhados
 * - Responses >= 500
 * - Responses 404 em URLs contendo /api/ (regra crítica)
 */
export function attachGuards(page: Page): ErrorCollection {
  const errors: ErrorCollection = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    badResponses: [],
    api404s: [],
  };

  // Capturar console.error
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Ignorar alguns erros comuns que não são críticos
      if (!text.includes("favicon.ico") && !text.includes("Failed to load resource: net::ERR_BLOCKED_BY_CLIENT")) {
        errors.consoleErrors.push(text);
        console.log(`\n🔴 Console Error: ${text}`);
      }
    }
  });

  // Capturar exceções JavaScript
  page.on("pageerror", (error) => {
    errors.pageErrors.push(error);
    console.log(`\n💥 Page Error: ${error.message}`);
  });

  // Capturar requests falhados
  page.on("requestfailed", (request) => {
    const url = request.url();
    const failureText = request.failure()?.errorText || "Unknown error";
    
    // Ignorar alguns falsos positivos e erros normais
    const shouldIgnore = 
      url.includes("favicon.ico") ||
      url.includes("chrome-extension://") ||
      // Ignorar erros de websocket do Firestore (ERR_ABORTED é normal em conexões websocket)
      (url.includes("firestore.googleapis.com") && failureText.includes("ERR_ABORTED")) ||
      // Ignorar outros erros de websocket que são normais
      (failureText.includes("ERR_ABORTED") && (url.includes("/Listen/") || url.includes("websocket")));
    
    if (!shouldIgnore) {
      errors.failedRequests.push({ url, failureText });
      console.log(`\n❌ Request Failed: ${url} - ${failureText}`);
    }
  });

  // Capturar responses com status >= 500 ou 404 em /api/
  page.on("response", (response) => {
    const url = response.url();
    const status = response.status();
    
    // Erros de servidor (500+)
    if (status >= 500) {
      errors.badResponses.push({ url, status });
      console.log(`\n🔥 Server Error ${status}: ${url}`);
    }
    
    // 404 em endpoints de API (REGRA CRÍTICA)
    if (status === 404 && (url.includes("/api/") || url.includes("cloudfunctions.net"))) {
      errors.api404s.push({ url });
      console.log(`\n⚠️  API 404 NOT FOUND: ${url}`);
    }
  });

  return errors;
}

/**
 * Verifica se há erros e retorna uma mensagem de resumo
 */
export function checkErrors(errors: ErrorCollection): { hasErrors: boolean; summary: string } {
  const hasErrors = 
    errors.consoleErrors.length > 0 ||
    errors.pageErrors.length > 0 ||
    errors.failedRequests.length > 0 ||
    errors.badResponses.length > 0 ||
    errors.api404s.length > 0;

  if (!hasErrors) {
    return { hasErrors: false, summary: "✅ Nenhum erro detectado" };
  }

  const lines: string[] = [];
  lines.push("\n" + "=".repeat(60));
  lines.push("❌ ERROS DETECTADOS DURANTE A NAVEGAÇÃO");
  lines.push("=".repeat(60));

  if (errors.consoleErrors.length > 0) {
    lines.push(`\n📛 Console Errors (${errors.consoleErrors.length}):`);
    errors.consoleErrors.forEach((err, i) => {
      lines.push(`   ${i + 1}. ${err.substring(0, 200)}${err.length > 200 ? "..." : ""}`);
    });
  }

  if (errors.pageErrors.length > 0) {
    lines.push(`\n💥 Page Errors (${errors.pageErrors.length}):`);
    errors.pageErrors.forEach((err, i) => {
      lines.push(`   ${i + 1}. ${err.message}`);
    });
  }

  if (errors.failedRequests.length > 0) {
    lines.push(`\n❌ Failed Requests (${errors.failedRequests.length}):`);
    errors.failedRequests.forEach((req, i) => {
      lines.push(`   ${i + 1}. ${req.url}`);
      lines.push(`      Error: ${req.failureText}`);
    });
  }

  if (errors.badResponses.length > 0) {
    lines.push(`\n🔥 Server Errors (${errors.badResponses.length}):`);
    errors.badResponses.forEach((resp, i) => {
      lines.push(`   ${i + 1}. [${resp.status}] ${resp.url}`);
    });
  }

  if (errors.api404s.length > 0) {
    lines.push(`\n⚠️  API 404 Errors (${errors.api404s.length}) - CRÍTICO:`);
    errors.api404s.forEach((resp, i) => {
      lines.push(`   ${i + 1}. ${resp.url}`);
    });
  }

  lines.push("\n" + "=".repeat(60));

  return { hasErrors: true, summary: lines.join("\n") };
}

/**
 * Reseta a coleção de erros
 */
export function resetErrors(errors: ErrorCollection): void {
  errors.consoleErrors = [];
  errors.pageErrors = [];
  errors.failedRequests = [];
  errors.badResponses = [];
  errors.api404s = [];
}
