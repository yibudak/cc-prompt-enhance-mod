# Records assets/demo.gif from a real Claude Code session.
# Run from the repo root: vhs scripts/demo.tape
# Needs VHS, a logged-in Claude Code, and the ctrl+e binding from the README.

Output assets/demo.gif

Set Shell bash
Set FontSize 26
Set Width 1760
Set Height 1000
Set Padding 28
Set WindowBar Colorful
Set Framerate 20
Set TypingSpeed 60ms

Hide
# A clean env, so nothing from a parent Claude session leaks into the footer
Type `unset $(env | grep -o -E '^(CLAUDE|CLAUDECODE|AI_AGENT)[A-Z0-9_]*') && export PS1='$ ' REPO=$PWD`
Enter
Type "rm -rf /tmp/demo-app && cp -R scripts/demo-app /tmp/demo-app && cd /tmp/demo-app"
Enter
# Settings that keep the screen to the conversation and the prompt
Type `clear && printf '\033[38;2;217;119;87m' && cat "$REPO/scripts/plush.txt" && printf '\033[0m\n' && claude --plugin-dir "$REPO" --model sonnet --permission-mode default --strict-mcp-config --disallowedTools Bash --settings '{"tui":"default","statusLine":{"type":"command","command":"true"},"showTurnDuration":false,"verbose":false,"spinnerTipsEnabled":false,"promptSuggestionEnabled":false}'`
Enter
Sleep 8s
Type "Read the code and tell me in one sentence why test_create_user fails."
Enter
# Reads only, so the tool call stays one line; the answer is the bullet after it
Wait+Screen@120s /to expand\)[\s\S]*⏺/
Sleep 3s
Show

Sleep 1s
Type "fix that error so the test pases"
Sleep 1.5s
Ctrl+E
Wait+Screen@90s /Revert/
Sleep 4s
