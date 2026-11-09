#!/usr/bin/env bash
#
# scripts/parity_diff.sh — HTML + CSS output-parity harness for the MOSAIC website.
#
# Written for the Astro 4 -> 5 -> 6 -> 7 upgrade (see
# blueprints/astro-7-typescript-6-upgrade/blueprint.md, steps 1, 2, 7, 8, 9, 10, 13 and 14),
# and kept in the repository because every future Astro major needs the same evidence.
#
# Run from the REPOSITORY ROOT (the directory holding frontend/ and .github/):
#
#   bash scripts/parity_diff.sh capture <label>
#   bash scripts/parity_diff.sh compare <baseline-label> <candidate-label>
#   bash scripts/parity_diff.sh pages   <label>
#
# Captures are stored outside the repository, under $MOSAIC_PARITY_DIR
# (default: $HOME/.mosaic-astro7-parity), so a 115-page dist/ copy never enters a commit,
# never reaches OneDrive's sync of the working tree, and never confuses the Astro build.
#
# EXIT CODES — every gate in the blueprint asserts one of these. None of them is a bare
# "non-zero": a usage error exits 1 and therefore fails any gate that expected 3, 4 or 5.
#
#   0  success
#   1  usage error, or a required input is missing
#   3  structural parity break: the set of built HTML pages changed (count or paths)
#   4  unacknowledged content differences remain
#   5  ACKNOWLEDGED.txt carries a line with no reason after the "|"
#
# WHAT IS COMPARED, AND WHY
#
#   HTML   every page, content-compared after normalisation. Gated.
#   CSS    all emitted stylesheets concatenated in a deterministic order into one
#          normalised bundle, content-compared. Gated — Astro 6 changed the render order of
#          <script> and <style>, so CSS can reorder silently while every build stays green.
#   assets the set of non-HTML files (added / removed). Gated.
#   JS     bundle CONTENT is reported but never gated: a new major's bundler legitimately
#          emits different JavaScript for identical source, and the user-visible contract
#          this harness defends is the rendered HTML and the emitted CSS.
#
# NORMALISATION
#
#   Astro/Vite put a content hash in emitted asset filenames (name.A1b2C3d4.css). The hash
#   changes whenever anything upstream of it changes, and it appears inside every HTML page
#   that links the asset — so without normalisation every page would differ on every run.
#   This script rewrites `.<8-12 chars>.<ext>` to `.HASH.<ext>` in both file paths and file
#   contents. Known limitation: a hand-authored filename whose middle segment happens to be
#   8-12 word characters is normalised too. That direction is safe (a false match hides a
#   name change, it never invents one), and no file in frontend/public/ matches today.
#
set -euo pipefail

PARITY_DIR="${MOSAIC_PARITY_DIR:-$HOME/.mosaic-astro7-parity}"
DIST_DIR="${MOSAIC_DIST_DIR:-frontend/dist}"

# Both variables carry their default here, inside the tool that reads them, so no call site
# in the blueprint has to export anything and no .env file is involved.

NORMALIZE_RE='s/\.[A-Za-z0-9_-]{8,12}\.(css|js|mjs|json|map|woff2|woff|ttf|otf|png|jpe?g|webp|avif|gif|svg|ico)/.HASH.\1/g'

normalize() {
  sed -E "$NORMALIZE_RE"
}

if command -v shasum >/dev/null 2>&1; then
  hash_stdin() { shasum -a 256 | cut -d' ' -f1; }
  hash_file() { shasum -a 256 "$1" | cut -d' ' -f1; }
else
  hash_stdin() { sha256sum | cut -d' ' -f1; }
  hash_file() { sha256sum "$1" | cut -d' ' -f1; }
fi

die() {
  printf '%s\n' "$1" >&2
  exit "$2"
}

# ---------------------------------------------------------------------------
# capture <label>
# ---------------------------------------------------------------------------
# Idempotent and non-destructive: if <label> was already captured this exits 0 and keeps
# the existing capture. That is deliberate. Re-running step 2 after a rung has moved must
# never overwrite the Astro 4 baseline with later output; the only way to recapture is to
# delete the label directory by hand.

cmd_capture() {
  local label="${1:-}"
  [ -n "$label" ] || die 'usage: bash scripts/parity_diff.sh capture <label>' 1

  local dest="$PARITY_DIR/$label"
  if [ -f "$dest/manifest.txt" ]; then
    printf 'capture: "%s" is already captured at %s — keeping it, nothing written.\n' "$label" "$dest"
    printf 'capture: delete that directory by hand if you really need to recapture.\n'
    return 0
  fi

  [ -d "$DIST_DIR" ] || die "capture: no build output at $DIST_DIR — run: npm --prefix frontend run build" 1

  rm -rf "$dest"
  mkdir -p "$dest/html"
  cp -R "$DIST_DIR" "$dest/dist"

  (cd "$dest/dist" && find . -type f) | sed 's|^\./||' | sort >"$dest/files.txt"

  # Normalised HTML, one flat file per page, so `diff` can address them individually.
  local rel flat norm h
  while IFS= read -r rel; do
    case "$rel" in
    *.html)
      flat=$(printf '%s' "$rel" | tr '/' '~')
      normalize <"$dest/dist/$rel" >"$dest/html/$flat"
      ;;
    esac
  done <"$dest/files.txt"

  # One normalised CSS bundle, ordered by normalised filename so the order is stable even
  # when the content hashes move.
  grep '\.css$' "$dest/files.txt" >"$dest/css-files.txt" || true
  : >"$dest/css-order.txt"
  if [ -s "$dest/css-files.txt" ]; then
    while IFS= read -r rel; do
      printf '%s\t%s\n' "$(printf '%s' "$rel" | normalize)" "$rel"
    done <"$dest/css-files.txt" | sort | cut -f2- >"$dest/css-order.txt"
  fi
  : >"$dest/styles.css"
  while IFS= read -r rel; do
    {
      printf '/* ===== %s ===== */\n' "$(printf '%s' "$rel" | normalize)"
      normalize <"$dest/dist/$rel"
      printf '\n'
    } >>"$dest/styles.css"
  done <"$dest/css-order.txt"

  # Manifest: normalised path -> hash of the NORMALISED content for text assets, raw hash
  # for binaries. Hashing the normalised content is what keeps an unchanged page equal
  # across majors when only an asset hash moved.
  : >"$dest/manifest.tmp"
  while IFS= read -r rel; do
    norm=$(printf '%s' "$rel" | normalize)
    case "$rel" in
    *.html | *.css | *.js | *.mjs | *.json | *.svg | *.xml | *.txt | *.map)
      h=$(normalize <"$dest/dist/$rel" | hash_stdin)
      ;;
    *)
      h=$(hash_file "$dest/dist/$rel")
      ;;
    esac
    printf '%s\t%s\n' "$norm" "$h" >>"$dest/manifest.tmp"
  done <"$dest/files.txt"
  sort "$dest/manifest.tmp" >"$dest/manifest.txt"
  rm -f "$dest/manifest.tmp"

  local pages files
  pages=$(grep -c '\.html$' "$dest/files.txt" || true)
  pages=${pages:-0}
  files=$(wc -l <"$dest/files.txt" | tr -d ' ')
  printf '%s\n' "$pages" >"$dest/pages.txt"
  printf 'captured "%s" at %s — %s files, %s HTML pages.\n' "$label" "$dest" "$files" "$pages"
}

# ---------------------------------------------------------------------------
# pages <label>
# ---------------------------------------------------------------------------

cmd_pages() {
  local label="${1:-}"
  [ -n "$label" ] || die 'usage: bash scripts/parity_diff.sh pages <label>' 1
  local f="$PARITY_DIR/$label/pages.txt"
  [ -f "$f" ] || die "pages: no capture for \"$label\" at $PARITY_DIR/$label" 1
  cat "$f"
}

# ---------------------------------------------------------------------------
# compare <baseline-label> <candidate-label>
# ---------------------------------------------------------------------------

cmd_compare() {
  local base="${1:-}" cand="${2:-}"
  { [ -n "$base" ] && [ -n "$cand" ]; } ||
    die 'usage: bash scripts/parity_diff.sh compare <baseline-label> <candidate-label>' 1

  local bdir="$PARITY_DIR/$base" cdir="$PARITY_DIR/$cand"
  [ -f "$bdir/manifest.txt" ] || die "compare: no capture for \"$base\" at $bdir" 1
  [ -f "$cdir/manifest.txt" ] || die "compare: no capture for \"$cand\" at $cdir" 1

  local report="$cdir/report-vs-$base.md"
  local ack="$cdir/ACKNOWLEDGED.txt"
  if [ ! -f "$ack" ]; then
    {
      printf '# Acknowledged output differences for the "%s" capture\n' "$cand"
      printf '#\n'
      printf '# One line per difference key, in the form:   <key> | <reason>\n'
      printf '# A line with no reason after the "|" makes `compare` exit 5.\n'
      printf '# Keys are printed by `compare` and listed in report-vs-<baseline>.md.\n'
      printf '#   html:<path>      an HTML page whose normalised content changed\n'
      printf '#   css              the normalised CSS bundle changed\n'
      printf '#   added:<path>     a non-HTML file the new build emits and the old one did not\n'
      printf '#   removed:<path>   a non-HTML file the old build emitted and the new one does not\n'
      printf '#   other:<path>     a non-HTML, non-CSS, non-JS file whose content changed\n'
    } >"$ack"
  fi

  local work
  work=$(mktemp -d)

  # ---- acknowledged keys, and the reason requirement ----------------------
  : >"$work/ack-keys"
  local bad_ack=0 line key reason
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in '' | '#'*) continue ;; esac
    case "$line" in
    *'|'*)
      key=${line%%|*}
      reason=${line#*|}
      ;;
    *)
      key="$line"
      reason=''
      ;;
    esac
    key=$(printf '%s' "$key" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')
    reason=$(printf '%s' "$reason" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')
    if [ -z "$reason" ]; then
      printf 'ACKNOWLEDGED.txt: no reason given for "%s" — use: %s | <reason>\n' "$key" "$key" >&2
      bad_ack=1
    fi
    printf '%s\n' "$key" >>"$work/ack-keys"
  done <"$ack"
  if [ "$bad_ack" -ne 0 ]; then
    rm -rf "$work"
    exit 5
  fi

  # ---- page sets ----------------------------------------------------------
  cut -f1 "$bdir/manifest.txt" | grep '\.html$' | sort >"$work/base-html" || true
  cut -f1 "$cdir/manifest.txt" | grep '\.html$' | sort >"$work/cand-html" || true
  comm -23 "$work/base-html" "$work/cand-html" >"$work/html-removed"
  comm -13 "$work/base-html" "$work/cand-html" >"$work/html-added"

  # ---- non-HTML file sets -------------------------------------------------
  cut -f1 "$bdir/manifest.txt" | grep -v '\.html$' | sort >"$work/base-assets" || true
  cut -f1 "$cdir/manifest.txt" | grep -v '\.html$' | sort >"$work/cand-assets" || true
  comm -23 "$work/base-assets" "$work/cand-assets" >"$work/assets-removed"
  comm -13 "$work/base-assets" "$work/cand-assets" >"$work/assets-added"

  # ---- content changes on paths present in both ---------------------------
  awk -F'\t' '
    NR == FNR { base[$1] = $2; next }
    { if (($1 in base) && base[$1] != $2) print $1 }
  ' "$bdir/manifest.txt" "$cdir/manifest.txt" | sort >"$work/changed-all"

  grep '\.html$' "$work/changed-all" >"$work/html-changed" || true
  grep '\.css$' "$work/changed-all" >"$work/css-changed" || true
  grep -E '\.(js|mjs)$' "$work/changed-all" >"$work/js-changed" || true
  grep -vE '\.(html|css|js|mjs)$' "$work/changed-all" >"$work/other-changed" || true

  # ---- the CSS bundle -----------------------------------------------------
  local css_differs=0
  if ! diff -u "$bdir/styles.css" "$cdir/styles.css" >"$work/styles.diff"; then
    css_differs=1
  fi

  # ---- gating keys --------------------------------------------------------
  : >"$work/keys"
  while IFS= read -r line; do printf 'html:%s\n' "$line" >>"$work/keys"; done <"$work/html-changed"
  [ "$css_differs" -eq 0 ] || printf 'css\n' >>"$work/keys"
  while IFS= read -r line; do printf 'added:%s\n' "$line" >>"$work/keys"; done <"$work/assets-added"
  while IFS= read -r line; do printf 'removed:%s\n' "$line" >>"$work/keys"; done <"$work/assets-removed"
  while IFS= read -r line; do printf 'other:%s\n' "$line" >>"$work/keys"; done <"$work/other-changed"
  sort -u "$work/keys" >"$work/keys.sorted"
  sort -u "$work/ack-keys" >"$work/ack.sorted"
  comm -23 "$work/keys.sorted" "$work/ack.sorted" >"$work/unacknowledged"

  local bpages cpages
  bpages=$(cat "$bdir/pages.txt")
  cpages=$(cat "$cdir/pages.txt")

  # ---- report -------------------------------------------------------------
  {
    printf '# Parity report — "%s" against baseline "%s"\n\n' "$cand" "$base"
    printf 'Generated: %s\n\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    printf '## Summary\n\n'
    printf '| Measure | Baseline "%s" | Candidate "%s" |\n' "$base" "$cand"
    printf '|---|---|---|\n'
    printf '| HTML pages | %s | %s |\n' "$bpages" "$cpages"
    printf '| HTML pages added | — | %s |\n' "$(wc -l <"$work/html-added" | tr -d ' ')"
    printf '| HTML pages removed | — | %s |\n' "$(wc -l <"$work/html-removed" | tr -d ' ')"
    printf '| HTML pages changed | — | %s |\n' "$(wc -l <"$work/html-changed" | tr -d ' ')"
    printf '| Non-HTML files added | — | %s |\n' "$(wc -l <"$work/assets-added" | tr -d ' ')"
    printf '| Non-HTML files removed | — | %s |\n' "$(wc -l <"$work/assets-removed" | tr -d ' ')"
    printf '| JS files changed (reported, not gated) | — | %s |\n' "$(wc -l <"$work/js-changed" | tr -d ' ')"
    printf '| CSS bundle | — | %s |\n\n' "$([ "$css_differs" -eq 0 ] && printf 'identical' || printf 'DIFFERS')"

    printf '## HTML pages\n\n'
    if [ -s "$work/html-added" ] || [ -s "$work/html-removed" ]; then
      printf 'STRUCTURAL BREAK — the route set changed.\n\n'
      printf '### Added\n\n```\n'
      cat "$work/html-added"
      printf '```\n\n### Removed\n\n```\n'
      cat "$work/html-removed"
      printf '```\n\n'
    else
      printf 'Route set identical: %s pages in both captures.\n\n' "$cpages"
    fi
    if [ -s "$work/html-changed" ]; then
      printf '### Pages whose normalised content changed\n\n'
      while IFS= read -r line; do
        printf -- '- `html:%s`\n' "$line"
      done <"$work/html-changed"
      printf '\n'
      printf '### Diffs\n\n'
      while IFS= read -r line; do
        flat=$(printf '%s' "$line" | tr '/' '~')
        printf '#### %s\n\n```diff\n' "$line"
        diff -u "$bdir/html/$flat" "$cdir/html/$flat" | head -n 200 || true
        printf '```\n\n'
      done <"$work/html-changed"
    else
      printf 'No HTML page changed.\n\n'
    fi

    printf '## CSS bundle\n\n'
    if [ "$css_differs" -eq 0 ]; then
      printf 'identical\n\n'
    else
      printf 'DIFFERS — acknowledge with the key `css`.\n\n```diff\n'
      head -n 800 "$work/styles.diff"
      printf '```\n\n'
    fi

    printf '## Non-HTML files\n\n'
    printf '### Added\n\n```\n'
    cat "$work/assets-added"
    printf '```\n\n### Removed\n\n```\n'
    cat "$work/assets-removed"
    printf '```\n\n### Changed, non-JS\n\n```\n'
    cat "$work/other-changed"
    printf '```\n\n'

    printf '## JavaScript — reported, never gated\n\n'
    printf 'A new Astro major emits different bundler output for identical source. These are\n'
    printf 'listed so a surprising one is visible, not so the build fails on them.\n\n```\n'
    cat "$work/js-changed"
    printf '```\n\n'

    printf '## Unacknowledged keys\n\n'
    if [ -s "$work/unacknowledged" ]; then
      printf 'Add each of these to %s as `<key> | <reason>`:\n\n```\n' "$ack"
      cat "$work/unacknowledged"
      printf '```\n'
    else
      printf 'None — every difference carries a reason in ACKNOWLEDGED.txt.\n'
    fi
  } >"$report"

  printf 'report written: %s\n' "$report"

  # ---- verdict ------------------------------------------------------------
  local structural=0
  [ ! -s "$work/html-added" ] || structural=1
  [ ! -s "$work/html-removed" ] || structural=1
  [ "$bpages" = "$cpages" ] || structural=1

  if [ "$structural" -ne 0 ]; then
    rm -rf "$work"
    die "compare: STRUCTURAL PARITY BREAK — the set of HTML pages changed ($bpages -> $cpages). Read $report. Do not acknowledge a route change; stop and report." 3
  fi

  if [ -s "$work/unacknowledged" ]; then
    printf 'compare: unacknowledged differences:\n' >&2
    cat "$work/unacknowledged" >&2
    rm -rf "$work"
    die "compare: classify each key above, then add it to $ack as '<key> | <reason>'." 4
  fi

  rm -rf "$work"
  printf 'parity OK: "%s" vs "%s" — %s HTML pages, every difference acknowledged with a reason.\n' \
    "$cand" "$base" "$cpages"
}

# ---------------------------------------------------------------------------

main() {
  local sub="${1:-}"
  [ "$#" -gt 0 ] && shift || true
  case "$sub" in
  capture) cmd_capture "$@" ;;
  compare) cmd_compare "$@" ;;
  pages) cmd_pages "$@" ;;
  *)
    die 'usage: bash scripts/parity_diff.sh {capture <label> | compare <baseline> <candidate> | pages <label>}' 1
    ;;
  esac
}

main "$@"
