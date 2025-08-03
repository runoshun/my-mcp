# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that provides a Gemini-powered
web search tool. The server implements a single tool called `gemini_search` that
uses the Google Gemini CLI to search the web and provide comprehensive
summaries.

## Architecture

- `main.ts`: Core MCP server implementation using `@modelcontextprotocol/sdk`
  - `GeminiToolsServer` class handles tool registration and execution
  - Implements `gemini_search` tool that spawns `npx @google/gemini-cli`
    subprocess
  - Uses stdio transport for MCP communication
- `main.test.ts`: Integration tests that launch server and test tool
  functionality
- Runtime: Deno with specific permissions for file/network/process access

## Development Commands

**IMPORTANT for Claude Code**: Always run checks before commits:

```bash
# Run server in development mode with file watching
deno task dev

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
```

## Required Permissions

The server requires these Deno permissions:

- `--allow-read`: Reading configuration files
- `--allow-env`: Accessing environment variables (PATH)
- `--allow-run`: Spawning Gemini CLI subprocess
- `--allow-write`: Required for tests that write configuration files

## Testing

Tests use MCP client-server integration approach, spawning the actual server
process and communicating over stdio. Tests gracefully handle cases where Gemini
CLI is not available.
