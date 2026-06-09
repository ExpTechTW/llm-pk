import { useEffect, useState } from "react";
import type { Database } from "sql.js";

import { loadDatabase } from "@/lib/db";

interface DbState {
  db: Database | null;
  loading: boolean;
  error: string | null;
}

export function useDb(): DbState {
  const [state, setState] = useState<DbState>({ db: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    loadDatabase()
      .then((db) => {
        if (active) setState({ db, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (active) {
          setState({ db: null, loading: false, error: err instanceof Error ? err.message : String(err) });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
