# Change: Update Agent CLI Settings

## Why
The CLI settings page only shows two tools and uses an outdated label. Users need a clear, unified view of supported Agent CLI tools, including install status, version, and install path.

## What Changes
- Rename the settings category label from "CLI Tools" to "Agent CLI".
- Replace the path configuration UI with a list-form table of five Agent CLI tools showing install status, version, and install path.
- Extend CLI tool detection to include OpenCode and return version + resolved install path.

## Impact
- Affected specs: agent-cli-settings (new)
- Affected code: renderer settings UI, CLI tool detection service, locale strings
