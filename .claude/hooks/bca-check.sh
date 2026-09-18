#!/usr/bin/env bash
# PostToolUse hook: after an agent edits a file, run `bca check` on just
# that file and, when a per-function threshold in bca.toml is crossed,
# feed the offender list back into the model's context.
#
# Advisory only. The edit has already happened by the time PostToolUse
# runs, so this never blocks anything -- it adds a note the model can act
# on while the code is still in flux. Exits 0 (silent) on a clean file,
# an unsupported file type, a missing analyzer, or any tool error: a
# complexity hint is never worth breaking someone's session over.
#
# Note bca cannot read CSS. app/globals.css is the largest file in this
# repo and most of its recent bugs lived there; this hook says nothing
# about any of it. Treat a silent run as "no complexity signal", not as
# "the edit is fine".
set -uo pipefail

root="${CLAUDE_PROJECT_DIR:-$PWD}"

# Resolve the analyzer. No bca => silent no-op, so a checkout without it
# behaves exactly as if the hook were absent.
if [ -n "${BCA:-}" ]; then
	bca="$BCA"
elif command -v bca >/dev/null 2>&1; then
	bca="bca"
elif [ -x "$HOME/.local/bin/bca" ]; then
	bca="$HOME/.local/bin/bca"
else
	exit 0
fi

command -v jq >/dev/null 2>&1 || exit 0

# PostToolUse delivers the tool call as JSON on stdin. Edit/Write/MultiEdit
# all carry the edited path at .tool_input.file_path.
file_path="$(jq -r '.tool_input.file_path // empty' 2>/dev/null)"
[ -n "$file_path" ] || exit 0
[ -f "$file_path" ] || exit 0   # deleted or renamed away

case "$file_path" in            # only files inside this repo
	"$root"/*) ;;
	*) exit 0 ;;
esac

case "$file_path" in            # only languages bca actually parses
	*.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.py) ;;
	*) exit 0 ;;
esac

# 0 = clean, 2 = offenders, anything else = tool error. Branch on 2 so a
# config mistake or an unparseable file stays quiet instead of being
# reported to the model as "complexity".
status=0
report="$("$bca" check "$file_path" --no-summary --no-remediation 2>/dev/null)" || status=$?
[ "$status" -eq 2 ] || exit 0
[ -n "$report" ] || exit 0

# Exit 2 is what makes Claude Code read stderr back into the model's
# context rather than discarding it.
guidance="$root/.claude/hooks/bca-guidance.txt"
{
	echo "bca flagged complexity in the file you just edited:"
	echo
	echo "$report"
	echo
	[ -f "$guidance" ] && cat "$guidance"
} >&2
exit 2
