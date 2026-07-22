export async function readJsonResponse<T>(response: Response): Promise<Partial<T>> {
  const text = await response.text();

  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return {};
  }
}
