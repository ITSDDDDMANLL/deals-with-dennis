export async function readErrorMessage(
  response: Response,
  fallback: string,
) {
  const text = await response.text().catch(() => "");
  const body = text
    ? (tryParseJson(text) as { error?: string; details?: string } | null)
    : null;
  const message = [body?.error, body?.details].filter(Boolean).join(" ");

  return message || text || `${fallback} HTTP ${response.status}.`;
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
