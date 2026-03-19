export interface IConfig {
  server?: {
    telnet?: number;
    ws?: number;
    http?: number;
    db?: string;
    counters?: string;
    chans?: string;
    mail?: string;
    wiki?: string;
    bboard?: string;
    corsOrigins?: string | string[];
    maxConnectionsPerIp?: number;
  };
  game?: {
    name?: string;
    description?: string;
    version?: string;
    playerStart?: string;
    text: {
      connect: string;
      welcome?: string;
    };
  };
  theme?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    surface?: string;
    text?: string;
    muted?: string;
    glass?: string;
    glassBorder?: string;
    backgroundImage?: string;
  };
  discord?: {
    token?: string;
    clientId?: string;
    guildId?: string;
    channels?: Record<string, string>;
  };
  intents?: {
    registry: Record<string, {
      priority: number;
      enabled: boolean;
      metadata?: Record<string, unknown>;
    }>;
    interceptorOrder: "FIFO" | "LIFO";
  };
  substitutions?: Record<string, string>;
  plugins?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface IPlugin {
  name: string;
  description?: string;
  version: string;
  config?: IConfig;
  init?: () => boolean | Promise<boolean>;
  remove?: () => void | Promise<void>;
}
