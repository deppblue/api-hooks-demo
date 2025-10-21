import { useCallback, useEffect, useRef, useState } from "react";
import type { PipelineClient } from "../core/orchestrator";
import type {
  ApiBody,
  ApiCatalog,
  ApiDto,
  ApiParams,
  ApiResult,
  ApiVo,
  ExecuteOptions,
} from "../core/types";

export interface UseApiRequestOptions {
  manual?: boolean;
  deps?: ReadonlyArray<unknown>;
}

export interface UseApiRequestState<TVo> {
  loading: boolean;
  data?: TVo;
  error?: unknown;
}

// React Hook 适配层示例，包装 Core 层的 execute 能力
export function useApiRequest<
  TCatalog extends ApiCatalog,
  Key extends keyof TCatalog & string
>(
  client: PipelineClient<TCatalog>,
  key: Key,
  baseOptions: ExecuteOptions<
    ApiParams<TCatalog, Key>,
    ApiBody<TCatalog, Key>,
    ApiDto<TCatalog, Key>
  >,
  options?: UseApiRequestOptions
) {
  const { manual = false, deps = [] } = options ?? {};
  const [state, setState] = useState<UseApiRequestState<ApiVo<TCatalog, Key>>>({
    loading: !manual,
  });
  const latestOptionsRef = useRef(baseOptions);
  const requestIdRef = useRef(0);
  const disposedRef = useRef(false);

  useEffect(() => {
    latestOptionsRef.current = baseOptions;
  }, [baseOptions]);

  const execute = useCallback(
    async (
      override?: Partial<
        ExecuteOptions<
          ApiParams<TCatalog, Key>,
          ApiBody<TCatalog, Key>,
          ApiDto<TCatalog, Key>
        >
      >
    ): Promise<ApiResult<ApiVo<TCatalog, Key>>> => {
      requestIdRef.current += 1;
      const currentId = requestIdRef.current;
      disposedRef.current = false;
      setState((prev) => ({
        ...prev,
        loading: true,
        error: undefined,
      }));

      const mergedOptions = {
        ...latestOptionsRef.current,
        ...override,
        params:
          (override?.params as ApiParams<TCatalog, Key> | undefined) ??
          latestOptionsRef.current.params,
        body:
          (override?.body as ApiBody<TCatalog, Key> | undefined) ??
          latestOptionsRef.current.body,
        query: {
          ...(latestOptionsRef.current.query ?? {}),
          ...(override?.query ?? {}),
        },
        headers: {
          ...(latestOptionsRef.current.headers ?? {}),
          ...(override?.headers ?? {}),
        },
        mockResponse:
          (override?.mockResponse as ApiDto<TCatalog, Key> | undefined) ??
          latestOptionsRef.current.mockResponse,
      } as ExecuteOptions<
        ApiParams<TCatalog, Key>,
        ApiBody<TCatalog, Key>,
        ApiDto<TCatalog, Key>
      >;

      const result = await client.execute(key, mergedOptions);
      if (disposedRef.current || currentId !== requestIdRef.current) {
        return result;
      }
      setState((prev) =>
        result.error
          ? {
              loading: false,
              error: result.error,
              data: prev.data,
            }
          : {
              loading: false,
              data: result.data,
              error: undefined,
            }
      );
      return result;
    },
    [client, key]
  );

  useEffect(() => {
    if (manual) {
      return;
    }
    execute().catch((error) => {
      setState({
        loading: false,
        error,
        data: undefined,
      });
    });
    return () => {
      disposedRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manual, execute, ...deps]);

  return {
    ...state,
    refetch: execute,
  };
}
