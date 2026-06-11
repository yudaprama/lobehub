import { useCallback, useEffect, useState } from 'react';

import { kratos } from './sdk';

export interface KratosSession {
  avatar_url?: string;
  email: string;
  id: string;
  name: string;
  username?: string;
}

export function useKratosSession() {
  const [session, setSession] = useState<KratosSession | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    try {
      const { data } = await kratos.toSession();
      if (!data?.identity) {
        setSession(null);
        return;
      }
      const traits = data.identity.traits as any;
      setSession({
        id: data.identity.id,
        email: traits?.email || '',
        name: traits?.name || '',
        username: traits?.username,
        avatar_url: traits?.avatar,
      });
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  return { session, loading, refetch: fetchSession };
}
