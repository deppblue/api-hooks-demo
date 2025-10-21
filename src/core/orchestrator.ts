import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import axios from 'axios'
import { PluginManager } from './pluginManager'
import { PipelineEngine } from './pipeline'
import type { ApiBody, ApiCatalog, ApiDto, ApiParams, ApiResult, ApiVo, ExecuteOptions, PipelineContext, PipelinePlugin, RequestHandler } from './types'
import { normalizeError } from './error'

export interface PipelineClientOptions<TCatalog extends ApiCatalog> {
  axiosInstance?: AxiosInstance
  catalog: TCatalog
  plugins: PipelinePlugin[]
  shared?: Record<string, unknown>
}

export interface PipelineClient<TCatalog extends ApiCatalog> {
  execute<Key extends keyof TCatalog & string>(key: Key, options: ExecuteOptions<ApiParams<TCatalog, Key>, ApiBody<TCatalog, Key>, ApiDto<TCatalog, Key>>): Promise<ApiResult<ApiVo<TCatalog, Key>>>
  getPlugins(): PipelinePlugin[]
  getAxiosInstance(): AxiosInstance
}

export function createPipelineClient<TCatalog extends ApiCatalog>(options: PipelineClientOptions<TCatalog>): PipelineClient<TCatalog> {
  const axiosInstance = options.axiosInstance ?? axios.create()
  const manager = new PluginManager(options.plugins)
  const sharedBase = options.shared ?? {}

  async function execute<Key extends keyof TCatalog & string>(
    key: Key,
    execOptions: ExecuteOptions<ApiParams<TCatalog, Key>, ApiBody<TCatalog, Key>, ApiDto<TCatalog, Key>>
  ): Promise<ApiResult<ApiVo<TCatalog, Key>>> {
    const definition = options.catalog[key]
    if (!definition) {
      throw new Error(`未找到接口定义：${key}`)
    }

    const requestConfig = buildRequestConfig(definition, execOptions)
    const context: PipelineContext<ApiParams<TCatalog, Key>, ApiBody<TCatalog, Key>, ApiDto<TCatalog, Key>, ApiVo<TCatalog, Key>, TCatalog> = {
      key,
      definition,
      options: execOptions,
      requestConfig,
      shared: { ...sharedBase },
    }

    const engine = new PipelineEngine(manager.getAll())
    const handler: RequestHandler<ApiDto<TCatalog, Key>> = () => axiosInstance.request<ApiDto<TCatalog, Key>>(context.requestConfig)

    if (execOptions.mockResponse) {
      context.shared.__mockResponse = execOptions.mockResponse
    }

    try {
      await engine.execute(context, handler)
      return {
        data: context.responseVo,
        raw: context.responseDto,
        context,
      }
    } catch (error) {
      const apiError = normalizeError(error)
      context.error = apiError
      return {
        error: apiError,
        raw: context.response?.data,
        context,
      }
    }
  }

  return {
    execute,
    getPlugins: () => manager.getAll(),
    getAxiosInstance: () => axiosInstance,
  }
}

function buildRequestConfig(
  definition: {
    method: string
    url: string
  },
  options: ExecuteOptions<any, any, any>
): AxiosRequestConfig {
  const { url, restParams } = interpolateUrl(definition.url, options.params)
  const config: AxiosRequestConfig = {
    method: definition.method,
    url,
    headers: { ...(options.headers ?? {}) },
  }

  const query = { ...(options.query ?? {}), ...restParams }
  if (Object.keys(query).length > 0) {
    config.params = query
  }
  if (options.body && definition.method !== 'GET') {
    config.data = options.body
  }

  return config
}

function interpolateUrl(template: string, params: Record<string, unknown>): { url: string; restParams: Record<string, unknown> } {
  const usedKeys = new Set<string>()
  const url = template.replace(/:([a-zA-Z0-9_]+)/g, (_match, key) => {
    usedKeys.add(key)
    const value = params[key]
    if (value === undefined) {
      throw new Error(`缺少路径参数：${key}`)
    }
    return encodeURIComponent(String(value))
  })

  const restParams: Record<string, unknown> = { ...params }
  for (const key of usedKeys) {
    delete restParams[key]
  }
  return { url, restParams }
}
