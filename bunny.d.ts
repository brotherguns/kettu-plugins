import type * as React from "react";

export interface Rule { userId: string; guildId: string; }

export interface PluginStorage { rules: Rule[]; }

export interface FluxDispatcher {
  subscribe(type: string, cb: (payload: any) => void): void;
  unsubscribe(type: string, cb: (payload: any) => void): void;
}

export interface Logger {
  log(...args: any[]): void;
  error(...args: any[]): void;
  warn(...args: any[]): void;
}

export interface PluginInstance {
  start?(): void;
  stop?(): void;
  SettingsComponent?(): JSX.Element;
}

export interface Bunny {
  metro: {
    findByProps(...props: string[]): any;
    common: {
      React: typeof React;
      FluxDispatcher: FluxDispatcher;
      [key: string]: any;
    };
  };
  plugin: {
    createStorage<T extends object = any>(): T;
    logger: Logger;
    manifest: any;
  };
  ui: any;
  api: any;
}

declare global {
  const bunny: Bunny;
  const definePlugin: (p: PluginInstance) => PluginInstance;
}
