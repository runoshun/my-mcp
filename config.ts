export interface ServerConfig {
  tools?: string[];
  configFile?: string;
  listTools?: boolean;
}

export interface ConfigFile {
  tools?: string[];
  serverName?: string;
  serverVersion?: string;
}

export async function loadConfigFile(path: string): Promise<ConfigFile> {
  try {
    const content = await Deno.readTextFile(path);
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load config file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function parseCliArgs(args: string[]): ServerConfig {
  const config: ServerConfig = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case "--tools":
      case "-t":
        if (i + 1 < args.length) {
          config.tools = args[++i].split(",").map(t => t.trim());
        }
        break;
      case "--config":
      case "-c":
        if (i + 1 < args.length) {
          config.configFile = args[++i];
        }
        break;
      case "--list":
      case "-l":
        config.listTools = true;
        break;
    }
  }
  
  return config;
}

export async function mergeConfigs(cliConfig: ServerConfig): Promise<ServerConfig> {
  const finalConfig: ServerConfig = { ...cliConfig };
  
  if (cliConfig.configFile) {
    const fileConfig = await loadConfigFile(cliConfig.configFile);
    
    if (!finalConfig.tools && fileConfig.tools) {
      finalConfig.tools = fileConfig.tools;
    }
  }
  
  return finalConfig;
}