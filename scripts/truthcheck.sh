#!/bin/sh
# truthcheck.sh — pins product truths so stale copy cannot come back.
# POSIX sh; uses git grep over tracked files only. CHANGELOG.md is exempt
# (it describes history), as are the lockfile and this script itself.
set -u
cd "$(dirname "$0")/.."

EXCLUDE=":(exclude)CHANGELOG.md :(exclude)package-lock.json :(exclude)scripts/truthcheck.sh"
status=0

forbid() {
    # $1 = ERE pattern, $2 = reason
    if git grep -nIiE "$1" -- . $EXCLUDE; then
        echo "TRUTHCHECK FAIL: $2"
        status=1
    fi
}

require() {
    # $1 = ERE pattern, $2 = reason
    if ! git grep -qIiE "$1" -- . $EXCLUDE; then
        echo "TRUTHCHECK FAIL: $2"
        status=1
    fi
}

# Forbidden stale claims
forbid '100[, ]?000[^0-9].{0,30}/ ?day|100k.{0,20}day' 'stale 100,000/day quota claim'
forbid '[Ff]ree[^.]{0,50}\b1,?000\b[^.]{0,15}(/|per )day'  'free tier paired with 1,000/day'
forbid 'livetennisapi\.com/docs' 'wrong docs URL — use docs.livetennisapi.com'
forbid 'bensynapse' 'personal identity in repo metadata'
forbid 'midnight UTC' 'daily reset is an absolute resets_at instant, not midnight UTC'

# Required truths (this repo states quotas)
require '100 requests/day|100/day' 'FREE quota copy (100 requests/day) missing'
require 'docs\.livetennisapi\.com' 'docs.livetennisapi.com link missing'

if [ "$status" -eq 0 ]; then
    echo "truthcheck OK"
fi
exit "$status"
