# Modular MCP Server (Deno)

A modular Model Context Protocol (MCP) server implemented in Deno with a pluggable tool architecture. It exposes multiple tools (web search, terminal, documentation, memory/graph) and supports flexible runtime configuration.

## Features

- Pluggable tool modules loaded at startup
- Stdio transport for MCP client integration
- Safe-by-default permissions; configurable per run
- Integration tests that spawn the real server
- Works locally with Deno or via mise

## Usage
### Requirements

- Deno (recommended via mise)
- For certain tools:
  - `tmux` (terminal tool)
  - Google Gemini CLI (gemini-search)


### Configuration
```json
{
  "mcpServers": {
    "modular": {
      "command": "deno",
      "args": [
        "run",
        "--allow-read",
        "--allow-write",
        "--allow-env",
        "--allow-run",
        "https://raw.githubusercontent.com/runoshun/my-mcp/refs/tags/v0.1.0/main.ts",
        "--tools",
        "gemini-search,terminal"
      ],
    }
  }
}
```

## Architecture

- `main.ts`: Core MCP server using `@modelcontextprotocol/sdk`.
  - Registers tools and dispatches executions.
  - Loads tools via CLI option `--tools`.
  - Communicates over stdio.
- `tools/`: Modular tool implementations.
  - `tool-interface.ts`: `ToolModule` interface for plugins.
  - `mod.ts`: Tool registry/loader.
  - Individual tool files implement functionality.
- `main.test.ts`: End‑to‑end tests launching the server process.

### Available Tools

- `gemini-search`: Web search and summarization via Google Gemini CLI
- `terminal`: Terminal session management using tmux
- `documentation`: Package documentation discovery and reading
- `memory`: Simple knowledge graph (entities, relations, observations)


## Install

Using mise (recommended when Deno is not on PATH):

```bash
# Install Deno via mise
mise install deno
```

## Run

Development server with file watching:

```bash
deno task dev
```

Run server with specific tools:

```bash
deno run --allow-read --allow-write --allow-env --allow-run main.ts --tools gemini-search,terminal
```

List available tools:

```bash
deno run --allow-read --allow-write --allow-env --allow-run main.ts --list
```

Using mise to run when Deno isn’t on PATH:

```bash
mise exec deno -- deno task dev
mise exec deno -- deno run --allow-read --allow-write --allow-env --allow-run main.ts --tools gemini-search
```

## Permissions

The server and tests require the following Deno permissions depending on the tools you use:

- `--allow-read`: Read configuration and tool data
- `--allow-write`: Persist tool data and temporary files (tests use this)
- `--allow-env`: Read environment variables (e.g., PATH)
- `--allow-run`: Spawn external processes (Gemini CLI, tmux, etc.)
- `--allow-net`: Network access (some tools and tests)

Grant only what you need for your run scenario.

## Testing

Type check only:

```bash
deno task check
```

Run tests (includes type checking):

```bash
deno task test
```

Some tests and tools may need timing or broader permissions; there is an unsafe preset:

```bash
deno task test-unsafe
```

Tests launch the real server and communicate over stdio. Missing external dependencies (e.g., Gemini CLI) are handled gracefully where possible.

## Project Structure

```
.
├─ main.ts            # MCP server entry
├─ main.test.ts       # Integration tests
├─ tools/             # Tool modules and registry
├─ deno.json          # Tasks and config
├─ deno.lock          # Dependency lockfile
└─ install_mise.sh    # Helper to install mise/Deno
```

## Troubleshooting

- Ensure required tools are installed (e.g., `tmux`, Gemini CLI) before enabling them.
- If a tool fails to load, re-run with `--list` to confirm it is available.
- Double‑check Deno permissions match the tools you enable.

## License

This repository does not currently declare a license. If you plan to distribute or modify, consider adding a license file.

