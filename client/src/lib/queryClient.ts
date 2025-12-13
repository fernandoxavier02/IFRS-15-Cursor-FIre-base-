import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { auth } from "./firebase";

// Helper para obter token Firebase Auth
async function getAuthToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

// Helper para construir URL de Cloud Functions
export function getCloudFunctionUrl(functionName: string): string {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "ifrs15-revenue-manager";
  const region = "us-central1";
  const useEmulators = import.meta.env.VITE_USE_EMULATORS === "true";
  
  if (useEmulators) {
    return `http://localhost:5001/${projectId}/${region}/${functionName}`;
  }
  
  return `https://${region}-${projectId}.cloudfunctions.net/${functionName}`;
}

// Converte URLs de API antigos para Cloud Functions
function convertApiUrl(url: string): string {
  // Se já é uma URL completa, retorna como está
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  
  // Mapeia endpoints antigos para Cloud Functions
  const apiMappings: Record<string, string> = {
    "/api/contracts": getCloudFunctionUrl("contractsApi"),
    "/api/customers": getCloudFunctionUrl("customersApi"),
    "/api/dashboard": getCloudFunctionUrl("dashboardApi"),
  };
  
  // Verifica mapeamento exato
  if (apiMappings[url]) {
    return apiMappings[url];
  }
  
  // Verifica mapeamento com prefixo (ex: /api/contracts/123)
  for (const [prefix, cfUrl] of Object.entries(apiMappings)) {
    if (url.startsWith(prefix + "/")) {
      const suffix = url.slice(prefix.length);
      return cfUrl + suffix;
    }
  }
  
  // Se não encontrou mapeamento, retorna URL original
  // (pode ser uma URL local ou ainda não migrada)
  return url;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = await getAuthToken();
  const finalUrl = convertApiUrl(url);
  
  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const res = await fetch(finalUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = await getAuthToken();
    const url = queryKey.join("/") as string;
    const finalUrl = convertApiUrl(url);
    
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    const res = await fetch(finalUrl, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutos
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
