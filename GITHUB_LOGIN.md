# GitHub Login with Claude Browse

Documentation for logging into GitHub using the claude-browse MCP plugin.

## Overview

GitHub uses HttpOnly cookies for session management, which cannot be accessed via JavaScript. This means the standard cookie extraction approach doesn't work. Instead, use the **interactive login** method.

## Interactive Login Flow

### 1. Start browser and navigate to login

```
mcp__plugin_browse_browse__goto: https://github.com/login
```

### 2. Enter credentials

```
mcp__plugin_browse_browse__type:
  selector: input[name="login"]
  text: <username>

mcp__plugin_browse_browse__type:
  selector: input[name="password"]
  text: <password>

mcp__plugin_browse_browse__click:
  selector: input[name="commit"]
```

### 3. Handle 2FA

GitHub may present SMS or authenticator-based 2FA.

**For SMS:**
```
mcp__plugin_browse_browse__click:
  selector: button:has-text("Send SMS")
```

Wait for user to provide code, then:
```
mcp__plugin_browse_browse__type:
  selector: input[name="sms_otp"]
  text: <6-digit-code>
```

The form may auto-submit. If not:
```
mcp__plugin_browse_browse__click:
  selector: button[type="submit"]
```

**Note:** The `input[name="otp"]` selector doesn't work - use `input[name="sms_otp"]` instead.

### 4. Save session for reuse

```
mcp__plugin_browse_browse__session_save:
  path: /path/to/github-session.json
```

### 5. Restore session in future

```
mcp__plugin_browse_browse__session_restore:
  path: /path/to/github-session.json
```

## Selector Reference

| Element | Selector |
|---------|----------|
| Username field | `input[name="login"]` |
| Password field | `input[name="password"]` |
| Sign in button | `input[name="commit"]` |
| SMS OTP field | `input[name="sms_otp"]` |
| Send SMS button | `button:has-text("Send SMS")` |

## Troubleshooting

### HttpOnly Cookies

GitHub's session cookies (`user_session`, `__Host-user_session_same_site`) are HttpOnly and cannot be read via `document.cookie`. The interactive login approach is required.

### Selector Timeouts

If `button:has-text("...")` times out, query all buttons first:
```
mcp__plugin_browse_browse__query:
  selector: button
```

Then use a more specific selector based on the returned attributes.

### Auto-submit Forms

GitHub's 2FA form may auto-submit after entering the code. Check if the page redirected before trying to click submit.

## Session Storage Location

Recommended path: `~/.claude/github-session.json`

The session file contains:
- Current URL
- All cookies (including HttpOnly ones captured by Playwright)
- localStorage
- sessionStorage

## Cookie Count

A successful GitHub login typically results in ~14 cookies being stored.
