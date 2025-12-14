import { QueryClient } from "@tanstack/react-query";
import { auth } from "./firebase";

// Helper para obter token Firebase Auth
export async function getAuthToken(): Promise<string | null> {
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

// QueryClient configurado para a aplicação
// Nota: Todas as queries agora usam services Firestore diretamente
// em vez de chamar endpoints /api/
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
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
