---
description: Save the current browsing session state to a file
---

Save the current session state to: $ARGUMENTS

Use the `session_save` tool to save:
- Current URL and page title
- All cookies
- localStorage data
- sessionStorage data

If no path is specified, save to `session.json` in the current directory.

This allows you to restore the session later with `/browse:restore`.
