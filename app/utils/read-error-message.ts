export async function readErrorMessage(
  response: Response,
  fallback: string,
) {
  const body = await response.json().catch(() => null) as
    | { error?: string; details?: string }
    | null;
  const message = [body?.error, body?.details].filter(Boolean).join(" ");

  return message || `${fallback} HTTP ${response.status}.`;
}
