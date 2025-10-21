import type { AxiosError } from "axios";
import type { ApiError } from "./types";

// 标准化错误对象，便于上层统一处理
export function normalizeError(source: unknown): ApiError {
  if (isApiError(source)) {
    return source;
  }

  if (isAxiosError(source)) {
    const status = source.response?.status;
    const base: ApiError = {
      name: "HttpError",
      message: source.message,
      type: status ? "Http" : "Network",
      status,
      raw: source,
      detail: source.response?.data,
    };
    return base;
  }

  const fallback: ApiError = {
    name: "UnknownError",
    message:
      source instanceof Error ? source.message : "未知错误，详见 detail 字段",
    type: "Unknown",
    raw: source,
    detail: source,
  };
  return fallback;
}

export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    typeof (error as ApiError).type === "string"
  );
}

function isAxiosError(error: unknown): error is AxiosError {
  return (
    typeof error === "object" &&
    error !== null &&
    "isAxiosError" in error &&
    Boolean((error as AxiosError).isAxiosError)
  );
}
