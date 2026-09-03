# MCP Servers

This project declares MCP servers in `.mcp.json`. Claude Code picks them up
automatically when you open the project and prompts you to approve them.

## 21st.dev Magic

Provides UI component generation tools.

`.mcp.json` references the API key through the `TWENTYFIRST_API_KEY`
environment variable rather than storing it inline — **this repository is
public, so a hardcoded key would be world-readable.**

### Setup

Export the key in your shell profile (`~/.zshrc`, `~/.bashrc`):

```bash
export TWENTYFIRST_API_KEY="21st_sk_your_key_here"
```

Restart your shell, then verify:

```bash
claude mcp list
```

`21st` should report as connected. If it reports `Missing environment
variables`, the export has not reached Claude Code's environment.

### Getting a key

Generate one at [21st.dev](https://21st.dev). Keys are secrets — never paste
one into a commit, an issue, a chat log, or a pull request. If a key is
exposed, revoke and regenerate it at 21st.dev.

## Note on remote sessions

`21st.dev` is blocked by the egress policy in Claude Code web/remote sessions,
so these tools are only available when running Claude Code locally.
