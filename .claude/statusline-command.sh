#!/bin/sh
input=$(cat)

model=$(echo "$input" | grep -o '"display_name":"[^"]*"' | head -1 | sed 's/"display_name":"//;s/"//')
cwd=$(echo "$input" | grep -o '"cwd":"[^"]*"' | head -1 | sed 's/"cwd":"//;s/"//')
used=$(echo "$input" | grep -o '"used_percentage":[0-9.]*' | head -1 | sed 's/"used_percentage"://')
five_h=$(echo "$input" | grep -o '"five_hour":{"used_percentage":[0-9]*' | grep -o '[0-9]*$')
seven_d=$(echo "$input" | grep -o '"seven_day":{"used_percentage":[0-9]*' | grep -o '[0-9]*$')

[ -z "$model" ] && model="Claude"

short_cwd=$(echo "$cwd" | cut -d'/' -f1-3)
branch=$(git -C "$cwd" branch --show-current 2>/dev/null)

dial() {
    p=$1
    if   [ "$p" -lt 20 ]; then printf '○'
    elif [ "$p" -lt 40 ]; then printf '◔'
    elif [ "$p" -lt 60 ]; then printf '◑'
    elif [ "$p" -lt 80 ]; then printf '◕'
    else printf '●'
    fi
}

# Build left content and track visible character count
vis_left=${#model}
c_model=$(printf '\033[1;34m%s\033[0m' "$model")

vis_left=$((vis_left + 2 + ${#short_cwd}))
c_cwd=$(printf '  \033[1;33m%s\033[0m' "$short_cwd")

if [ -n "$branch" ]; then
    vis_left=$((vis_left + 4 + ${#branch}))
    c_branch=$(printf '  \033[1;35m(%s)\033[0m' "$branch")
else
    c_branch=""
fi

if [ -n "$used" ]; then
    pct=$(printf '%.0f' "$used")
    vis_left=$((vis_left + 12 + ${#pct}))
    c_ctx=$(printf '  ctx:\033[1;32m%s%%\033[0m used' "$pct")
else
    c_ctx=""
fi

left="${c_model}${c_cwd}${c_branch}${c_ctx}"

# Right: plan usage dials (5h and 7d rate limits)
if [ -n "$five_h" ] && [ -n "$seven_d" ]; then
    d5=$(dial "$five_h")
    d7=$(dial "$seven_d")
    vis_right=$((14 + ${#five_h} + ${#seven_d}))
    right=$(printf '\033[0;37m5h %s %s%%  7d %s %s%%\033[0m' "$d5" "$five_h" "$d7" "$seven_d")

    cols=$(tput cols 2>/dev/null || echo "${COLUMNS:-80}")
    pad=$((cols - vis_left - vis_right - 2))
    [ "$pad" -lt 1 ] && pad=1
    spaces=$(printf '%*s' "$pad" "")
    printf '%s%s%s' "$left" "$spaces" "$right"
else
    printf '%s' "$left"
fi
