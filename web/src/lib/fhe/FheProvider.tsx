"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";
import { SEPOLIA_RPC_URL } from "@/lib/addresses";

type FheStatus = "idle" | "loading" | "ready" | "error";

type FheContextValue = {
  status: FheStatus;
  error: string | undefined;
  getInstance: () => Promise<FhevmInstance>;
};

const FheContext = createContext<FheContextValue | undefined>(undefined);

export function FheProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<FheStatus>("idle");
  const [error, setError] = useState<string | undefined>(undefined);
  const instanceRef = useRef<FhevmInstance | undefined>(undefined);
  const pendingRef = useRef<Promise<FhevmInstance> | undefined>(undefined);

  const getInstance = useCallback(async (): Promise<FhevmInstance> => {
    if (instanceRef.current) return instanceRef.current;
    if (pendingRef.current) return pendingRef.current;

    // Lazy load on the client only: the SDK pulls a WASM module that must never
    // run during server rendering. Imported here rather than at module top level.
    const load = (async (): Promise<FhevmInstance> => {
      setStatus("loading");
      setError(undefined);
      try {
        const { initSDK, createInstance, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/web");
        await initSDK();
        const instance = await createInstance({ ...SepoliaConfig, network: SEPOLIA_RPC_URL });
        instanceRef.current = instance;
        setStatus("ready");
        return instance;
      } catch (caught) {
        pendingRef.current = undefined;
        const message = caught instanceof Error ? caught.message : "Failed to initialize the FHE client";
        setError(message);
        setStatus("error");
        throw caught;
      }
    })();

    pendingRef.current = load;
    return load;
  }, []);

  return <FheContext.Provider value={{ status, error, getInstance }}>{children}</FheContext.Provider>;
}

export function useFhe(): FheContextValue {
  const value = useContext(FheContext);
  if (!value) throw new Error("[useFhe] must be used within a FheProvider");
  return value;
}
