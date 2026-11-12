import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api";

/** Signs the user out when the API rejects their token, and drops cached data on sign-out. */
export function QueryProvider({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth();

  const [queryClient] = useState(() => {
    const onError = (error: Error) => {
      if (error instanceof ApiError && error.sessionExpired) signOut("expired");
    };
    return new QueryClient({
      queryCache: new QueryCache({ onError }),
      mutationCache: new MutationCache({ onError }),
      defaultOptions: {
        queries: {
          // Client errors such as 401 or 404 will not succeed on retry.
          retry: (failureCount, error) =>
            failureCount < 2 &&
            !(error instanceof ApiError && error.status >= 400 && error.status < 500),
        },
      },
    });
  });

  useEffect(() => {
    if (!session) queryClient.clear();
  }, [session, queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
