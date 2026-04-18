/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Safely retrieves environment variables in both Node and Browser (Vite) environments.
 */
export function getEnv(name: string, fallback: string = ""): string {
  try {
    // Check for Vite's import.meta.env first (Browser)
    const viteEnv = (import.meta as any).env?.[name] || (import.meta as any).env?.[`VITE_${name}`];
    if (viteEnv) return viteEnv;

    // Check for process.env (Node or Vite define)
    if (typeof process !== 'undefined' && process.env) {
      return process.env[name] || "";
    }
  } catch (e) {
    // Silent fail
  }
  return fallback;
}

export const isBrowser = typeof window !== 'undefined';
export const isNode = !isBrowser;
