import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { getJwt } from "./auth";

const API = process.env.API_BASE_URL!;

// Memoized per request: read the incoming cookies once, mint the JWT once.
const incomingCookie = cache(async () => (await headers()).get("cookie"));
const requestJwt = cache(async () => getJwt(await incomingCookie()));

export class ApiAuthError extends Error {
  constructor(message = "Not authenticated") {
    super(message);
    this.name = "ApiAuthError";
  }
}

/**
 * BFF fetch: attaches the server-minted Bearer JWT and calls the .NET API. The browser
 * never sees the JWT or talks to the API directly.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const jwt = await requestJwt();
  if (!jwt) throw new ApiAuthError();

  const requestHeaders: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${jwt}`,
  };
  if (init?.body && !requestHeaders["Content-Type"]) {
    requestHeaders["Content-Type"] = "application/json";
  }

  return fetch(`${API}${path}`, { ...init, headers: requestHeaders, cache: "no-store" });
}

/** apiFetch + JSON parsing, mapping auth/transport failures to typed errors. */
export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (res.status === 401) throw new ApiAuthError();
  if (!res.ok) {
    throw new Error(`API ${res.status} on ${path}: ${await res.text().catch(() => "")}`);
  }
  return res.json() as Promise<T>;
}
