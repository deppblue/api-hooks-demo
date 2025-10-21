import type { AxiosResponse } from "axios";
import type { PipelinePlugin } from "../core/types";

export interface RuntimeContext {
  getToken(): string | undefined;
  getTenantId(): string | undefined;
}

export function createRuntimeContextPlugin(
  runtime: RuntimeContext
): PipelinePlugin {
  return {
    name: "runtime-context",
    enforce: "pre",
    beforeRequest(ctx) {
      const headers: Record<string, string> = {
        ...(ctx.requestConfig.headers as Record<string, string> | undefined),
      };
      const token = runtime.getToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const tenantId = runtime.getTenantId();
      if (tenantId) {
        headers["X-Tenant-Id"] = tenantId;
      }
      ctx.requestConfig.headers = headers;
    },
  };
}

export function createMockPlugin(): PipelinePlugin {
  return {
    name: "mock-response",
    enforce: "pre",
    async onRequest(ctx, next) {
      const mock =
        ctx.options.mockResponse ?? (ctx.shared.__mockResponse as unknown);
      if (mock) {
        const mockResponse: AxiosResponse = {
          data: mock,
          status: 200,
          statusText: "MOCK",
          headers: { "x-mock": "true" },
          config: ctx.requestConfig,
        };
        ctx.response = mockResponse;
        ctx.responseDto = mock;
        return mockResponse;
      }
      return next();
    },
  };
}

export function createLoggingPlugin(): PipelinePlugin {
  return {
    name: "logging",
    enforce: "post",
    afterSuccess(ctx) {
      // Demo 仅打印关键流程，真实项目可换成更专业的日志工具
      console.info(
        `[pipeline] ${ctx.key} 成功`,
        ctx.requestConfig.url,
        ctx.responseVo
      );
    },
    afterError(ctx, error) {
      console.error(`[pipeline] ${ctx.key} 失败`, error);
    },
  };
}
