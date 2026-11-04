const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The live preview only ever loads this computer's own dev servers. Anything else
 * (other hosts, other schemes) is refused, so a pasted link can never load a remote page.
 */
export function parseLocalUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!LOCAL_HOSTS.has(url.hostname)) return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}
