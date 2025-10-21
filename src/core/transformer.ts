import type { PipelineContext, PipelinePlugin } from "./types";

export interface TransformContext {
  key: string;
  shared: Record<string, unknown>;
}

export type Transformer<TDto, TVo> = (
  input: TDto,
  context: TransformContext
) => TVo;

export class TransformerRegistry {
  private readonly transformers = new Map<string, Transformer<any, any>>();

  register<TDto, TVo>(key: string, transformer: Transformer<TDto, TVo>) {
    this.transformers.set(key, transformer);
  }

  get<TDto, TVo>(key: string): Transformer<TDto, TVo> | undefined {
    return this.transformers.get(key);
  }
}

export function createTransformerPlugin(): PipelinePlugin {
  return {
    name: "transformer",
    enforce: "post",
    afterResponse(ctx) {
      const transformKey = ctx.definition.transformKey;
      if (!transformKey) {
        ctx.responseVo = ctx.responseDto as typeof ctx.responseVo;
        return;
      }
      const registry = ctx.shared.transformerRegistry as TransformerRegistry;
      if (!registry) {
        throw new Error("未在 shared 中找到 transformerRegistry");
      }
      const transformer = registry.get(transformKey);
      if (!transformer) {
        throw new Error(`未找到转换器：${transformKey}`);
      }
      ctx.responseVo = transformer(ctx.responseDto, {
        key: ctx.key,
        shared: ctx.shared,
      }) as typeof ctx.responseVo;
    },
  };
}
