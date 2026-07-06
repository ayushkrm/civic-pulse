"use client";

import { useEffect, useState } from "react";

/** Fetch a JSON API route. Keeps stale data visible while refetching. */
export function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    fetch(url)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? r.statusText);
        return json as T;
      })
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [url]);

  return { data, error, loading };
}
