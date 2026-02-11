# Check and Reinstall Plugin

Verify and reinstall the browse plugin with all its dependencies.

## Steps to Execute

### 1. Check and Push Source Repository

```bash
# Check git status
git status
git log -1 --oneline

# If there are uncommitted changes, commit and push
git add -A && git commit -m "Plugin update" && git push || echo "Nothing to commit"
```

### 2. Build and Install npm Package Globally

```bash
npm run build
npm install -g .
```

### 3. Check and Update Marketplace Repository

The marketplace repo is at `~/.claude/plugins/marketplaces/saiden/` (cloned from `saiden-dev/claude-plugins`).

```bash
# Check marketplace repo status
cd ~/.claude/plugins/marketplaces/saiden
git status
git log -1 --oneline

# Pull latest changes
git pull origin main || git pull origin master
```

The marketplace repo should contain plugin metadata pointing to the source repo. Check if it needs updating:

```bash
# Check the plugin definition in marketplace
cat ~/.claude/plugins/marketplaces/saiden/plugins/browse/plugin.json
```

If the marketplace needs to pull the latest source changes, the plugin definition should reference the correct commit or version.

### 4. Remove and Re-add Marketplace

```bash
claude plugin marketplace remove saiden
claude plugin marketplace add saiden-dev/claude-plugins
```

### 5. Remove and Re-add Plugin

```bash
# Remove plugin cache and registry entry
rm -rf ~/.claude/plugins/cache/saiden/browse
jq 'del(.plugins["browse@saiden"])' ~/.claude/plugins/installed_plugins.json > /tmp/plugins.json && mv /tmp/plugins.json ~/.claude/plugins/installed_plugins.json

# Reinstall plugin
claude plugin install browse@saiden
```

### 6. Verify Plugin MCP Server Name

```bash
# Check the installed plugin's MCP configuration
cat ~/.claude/plugins/cache/saiden/browse/*/. claude-plugin/.mcp.json
```

The MCP server key MUST be `"context"`, not `"browse"`:

```json
{
  "mcpServers": {
    "context": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/dist/mcp.js"]
    }
  }
}
```

### 7. Restart Claude Code

After all steps, restart Claude Code to pick up the changes:

```bash
# User should restart Claude Code manually
echo "Please restart Claude Code to apply changes"
```

## Verification

After restarting Claude Code, run `/plugin` and verify the output shows:
```
browse Plugin · saiden · ✔ enabled
└ context MCP · ✔ connected
```

If it still shows "browse MCP", the marketplace repo may not have been updated with the latest source code.
