import type { AxiosRequestConfig, AxiosResponse } from "axios";

// 完整流水线需要用到的公共类型
export type Awaitable<T> = T | Promise<T>;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// API 目录项，将运行时的元信息与类型参数绑定在一起
export interface ApiCatalogItem<TParams, TBody, TDto, TVo> {
  method: HttpMethod;
  url: string;
  transformKey?: string;
  description?: string;
  // 该字段仅用于承载泛型信息，运行时不会读取
  __types__?: {
    params: TParams;
    body: TBody;
    responseDto: TDto;
    responseVo: TVo;
  };
}

export type ApiCatalog = Record<string, ApiCatalogItem<any, any, any, any>>;

export type ApiParams<Catalog extends ApiCatalog, Key extends keyof Catalog> =
  Catalog[Key] extends ApiCatalogItem<infer TParams, any, any, any>
    ? TParams
    : never;

export type ApiBody<Catalog extends ApiCatalog, Key extends keyof Catalog> =
  Catalog[Key] extends ApiCatalogItem<any, infer TBody, any, any>
    ? TBody
    : never;

export type ApiDto<Catalog extends ApiCatalog, Key extends keyof Catalog> =
  Catalog[Key] extends ApiCatalogItem<any, any, infer TDto, any>
    ? TDto
    : never;

export type ApiVo<Catalog extends ApiCatalog, Key extends keyof Catalog> =
  Catalog[Key] extends ApiCatalogItem<any, any, any, infer TVo>
    ? TVo
    : never;

export interface ExecuteOptions<TParams, TBody, TDto> {
  params: TParams;
  body?: TBody;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
  mockResponse?: TDto;
}

export interface ApiResult<TVo> {
  data?: TVo;
  error?: ApiError;
  raw?: unknown;
  context: PipelineContext<any, any, any, TVo>;
}

export interface PipelineContext<
  TParams,
  TBody,
  TDto,
  TVo,
  TCatalog extends ApiCatalog = ApiCatalog
> {
  key: keyof TCatalog & string;
  definition: ApiCatalogItem<TParams, TBody, TDto, TVo>;
  options: ExecuteOptions<TParams, TBody, TDto>;
  requestConfig: AxiosRequestConfig<TBody>;
  response?: AxiosResponse<TDto>;
  responseDto?: TDto;
  responseVo?: TVo;
  error?: ApiError;
  shared: Record<string, unknown>;
}

export type RequestHandler<TDto> = () => Promise<AxiosResponse<TDto>>;

export interface PipelinePlugin<
  TContext extends PipelineContext<any, any, any, any> = PipelineContext<
    any,
    any,
    any,
    any
  >
> {
  name: string;
  enforce?: "pre" | "post";
  deps?: string[];
  onInit?(plugins: PipelinePlugin[]): void;
  beforePrepare?(ctx: TContext): Awaitable<void>;
  beforeRequest?(ctx: TContext): Awaitable<void>;
  onRequest?(
    ctx: TContext,
    next: RequestHandler<TContext["responseDto"]>
  ): Awaitable<AxiosResponse<TContext["responseDto"]>>;
  afterResponse?(ctx: TContext): Awaitable<void>;
  afterSuccess?(ctx: TContext): Awaitable<void>;
  afterError?(ctx: TContext, error: ApiError): Awaitable<void>;
}

export interface ApiError extends Error {
  type: "Network" | "Http" | "Transform" | "Unknown";
  status?: number;
  detail?: unknown;
  raw?: unknown;
}

export function defineApiCatalog<TCatalog extends ApiCatalog>(
  catalog: TCatalog
): TCatalog {
  return catalog;
}
