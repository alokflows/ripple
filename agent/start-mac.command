#!/bin/bash
# Yap desktop agent (macOS) — double-click this file to start.
# Text you send from your phone will paste wherever your cursor is.
cd "$(dirname "$0")" || exit 1

if [ ! -d .venv ]; then
  echo "First run — setting things up (takes a moment)…"
  python3 -m venv .venv && ./.venv/bin/pip install -q -r requirements.txt
fi

echo "──────────────────────────────────────────────"
echo " Yap — phone → your cursor"
echo " Enter the SAME pairing code shown in the phone app."
echo ""
echo " First time only: macOS will block keystrokes until you grant"
echo " Accessibility permission to Terminal:"
echo "   System Settings → Privacy & Security → Accessibility → enable Terminal,"
echo " then quit and re-run this. Without it, text copies but won't auto-paste."
echo "──────────────────────────────────────────────"
exec ./.venv/bin/python agent.py "$@"
