export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const isJson = res.headers.get("content-type")?.includes("application/json") ?? false;
  const body = isJson ? await res.json() : undefined;

  if (!res.ok) {
    const message = (body as { error?: string } | undefined)?.error ?? `Errore ${res.status}`;
    throw new ApiError(res.status, message, (body as { details?: unknown } | undefined)?.details);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path),
  post: <T>(path: string, data?: unknown): Promise<T> =>
    request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown): Promise<T> =>
    request<T>(path, { method: "PUT", body: data !== undefined ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string): Promise<T> => request<T>(path, { method: "DELETE" }),
};

export async function downloadFile(path: string): Promise<void> {
  const res = await fetch(path);
  if (!res.ok) {
    const isJson = res.headers.get("content-type")?.includes("application/json") ?? false;
    const body = isJson ? await res.json() : undefined;
    const message = (body as { error?: string } | undefined)?.error ?? `Errore ${res.status}`;
    throw new ApiError(res.status, message);
  }

  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? "download";

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(path, { method: "POST", body: formData });

  const isJson = res.headers.get("content-type")?.includes("application/json") ?? false;
  const body = isJson ? await res.json() : undefined;

  if (!res.ok) {
    const message = (body as { error?: string } | undefined)?.error ?? `Errore ${res.status}`;
    throw new ApiError(res.status, message, (body as { details?: unknown } | undefined)?.details);
  }

  return body as T;
}
