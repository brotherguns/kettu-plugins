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
  warn?(...args: any[]): void;
}

// The object the Vendetta loader passes to a plugin: `vendetta => { return <plugin> }`
export interface Vendetta {
  metro: {
    findByProps(...props: string[]): any;
    common: {
      React: typeof React;
      FluxDispatcher: FluxDispatcher;
      ReactNative: any;
      [key: string]: any;
    };
    [key: string]: any;
  };
  plugin: {
    id: string;
    manifest: any;
    storage: any;
  };
  logger: Logger;
  ui: {
    components: {
      Forms: any;
      General: any;
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

// A Vendetta plugin instance (polymanifest). Returned as the module default export.
export interface VendettaPlugin {
  onLoad?(): void;
  onUnload(): void;
  settings?: React.ComponentType<any>;
}

declare global {
  // Provided lexically by the loader wrapper, not a real global — declared so
  // source can reference it. esbuild leaves the free identifier in the bundle.
  const vendetta: Vendetta;
}
