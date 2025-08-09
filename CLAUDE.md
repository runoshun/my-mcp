# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

This is a modular MCP (Model Context Protocol) server that provides multiple
tools through a pluggable architecture. The server supports configurable tool
loading and includes tools for web search, terminal operations, documentation
access, and knowledge graph management.

## Architecture

- `main.ts`: Core MCP server implementation using `@modelcontextprotocol/sdk`
  - `ModularMCPServer` class handles tool registration and execution
  - Supports configurable tool loading via CLI arguments
  - Uses stdio transport for MCP communication
- `tools/`: Modular tool implementations
  - `tool-interface.ts`: Defines the `ToolModule` interface for plugin architecture
  - `mod.ts`: Central registry of available tools
  - Individual tool modules implement specific functionality
- `main.test.ts`: Integration tests that launch server and test tool functionality
- Runtime: Deno with specific permissions for file/network/process access

### Available Tools

- **gemini-search**: Web search and summarization using Google Gemini CLI
- **terminal**: Terminal session management with tmux integration
- **documentation**: Package documentation discovery and reading
- **memory**: Knowledge graph operations (entities, relations, observations)

## Development Commands

**IMPORTANT for Claude Code**: Always run checks before commits:

```bash
# Run server in development mode with file watching
deno task dev

# Run server with specific tools
deno run --allow-read --allow-write --allow-env --allow-run main.ts --tools gemini-search,terminal

# List available tools
deno run --allow-read --allow-write --allow-env --allow-run main.ts --list

# Run type checking
deno task check

# Run tests (includes type checking)
deno task test

# Run tests with additional timing permissions (unsafe)
deno task test-unsafe
```

### Running with mise

If Deno is not in your PATH, use mise to run commands:

```bash
# Install Deno via mise
mise install deno

# Run commands with mise exec
mise exec deno -- deno task test
mise exec deno -- deno task check
mise exec deno -- deno task dev

# Run server with specific tools via mise
mise exec deno -- deno run --allow-read --allow-write --allow-env --allow-run main.ts --tools gemini-search
```

## Required Permissions

The server requires these Deno permissions:

- `--allow-read`: Reading configuration files and tool data
- `--allow-write`: Writing tool data and temporary files (required for tests)
- `--allow-env`: Accessing environment variables (PATH, configuration)
- `--allow-run`: Spawning external processes (Gemini CLI, tmux, etc.)
- `--allow-net`: Network access (for tests and some tool functionality)

## Testing

Tests use MCP client-server integration approach, spawning the actual server
process and communicating over stdio. Tests gracefully handle cases where
external dependencies (like Gemini CLI) are not available. The modular
architecture allows testing individual tools in isolation.
