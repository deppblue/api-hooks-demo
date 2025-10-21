import type { PipelinePlugin } from "./types";

// 插件注册器，负责排序与依赖校验
export class PluginManager {
  private readonly plugins: PipelinePlugin[];
  private readonly nameSet: Set<string>;

  constructor(plugins: PipelinePlugin[]) {
    this.nameSet = new Set();
    this.plugins = this.sortPlugins(plugins);
    this.plugins.forEach((plugin) => {
      plugin.onInit?.(this.plugins);
    });
  }

  getAll(): PipelinePlugin[] {
    return this.plugins;
  }

  private sortPlugins(plugins: PipelinePlugin[]): PipelinePlugin[] {
    const prepared = plugins.map((plugin) => {
      if (this.nameSet.has(plugin.name)) {
        throw new Error(`重复注册插件：${plugin.name}`);
      }
      this.nameSet.add(plugin.name);
      return plugin;
    });

    const sorted = [
      ...prepared.filter((p) => p.enforce === "pre"),
      ...prepared.filter((p) => !p.enforce),
      ...prepared.filter((p) => p.enforce === "post"),
    ];

    sorted.forEach((plugin) => {
      if (!plugin.deps) {
        return;
      }
      plugin.deps.forEach((dep) => {
        if (!this.nameSet.has(dep)) {
          throw new Error(`插件 ${plugin.name} 依赖未注册的插件 ${dep}`);
        }
      });
    });

    return sorted;
  }
}
