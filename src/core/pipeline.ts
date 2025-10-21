import type {
  PipelineContext,
  PipelinePlugin,
  RequestHandler,
} from "./types";
import { normalizeError } from "./error";

// PipelineEngine 负责串联执行插件生命周期
export class PipelineEngine<
  TContext extends PipelineContext<any, any, any, any>
> {
  constructor(private readonly plugins: PipelinePlugin<TContext>[]) {}

  async execute(
    ctx: TContext,
    handler: RequestHandler<TContext["responseDto"]>
  ): Promise<void> {
    await this.runStage("beforePrepare", ctx);
    await this.runStage("beforeRequest", ctx);

    try {
      const response = await this.composeOnRequest(ctx, handler);
      ctx.response = response;
      ctx.responseDto = response.data;
    } catch (error) {
      const apiError = normalizeError(error);
      ctx.error = apiError;
      await this.runErrorStage(ctx, apiError);
      throw apiError;
    }

    await this.runStage("afterResponse", ctx);
    await this.runStage("afterSuccess", ctx);
  }

  private async runStage(
    stage: keyof PipelinePlugin,
    ctx: TContext
  ): Promise<void> {
    for (const plugin of this.plugins) {
      const handler = plugin[stage as keyof PipelinePlugin];
      if (typeof handler === "function") {
        await (handler as (context: TContext) => Promise<void> | void)(ctx);
      }
    }
  }

  private async runErrorStage(
    ctx: TContext,
    error: Parameters<PipelinePlugin<TContext>["afterError"]>[1]
  ): Promise<void> {
    for (const plugin of this.plugins) {
      if (typeof plugin.afterError === "function") {
        await plugin.afterError(ctx, error);
      }
    }
  }

  private composeOnRequest(
    ctx: TContext,
    handler: RequestHandler<TContext["responseDto"]>
  ) {
    const plugins = this.plugins;

    const dispatch = (index: number): Promise<
      ReturnType<RequestHandler<TContext["responseDto"]>>
    > => {
      if (index >= plugins.length) {
        return handler();
      }
      const plugin = plugins[index];
      if (!plugin.onRequest) {
        return dispatch(index + 1);
      }
      return Promise.resolve(
        plugin.onRequest(ctx, () => dispatch(index + 1))
      );
    };

    return dispatch(0);
  }
}
