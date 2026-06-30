#!/usr/bin/env bash
set -euo pipefail

# combine-project-sources.sh
# Combines common source/config/text files into one readable TXT bundle for sharing with Copilot/ChatGPT.
# Run from your project root, for example:
#   cd ~/pixiJS/three-clean
#   bash combine-project-sources.sh
#
# Output:
#   combined-project-source-bundle.txt

OUT="${1:-combined-project-source-bundle.txt}"
ROOT="$(pwd)"

# File extensions to include. Add/remove extensions if needed.
EXTENSIONS=(
  "ts" "tsx" "js" "jsx" "mjs" "cjs"
  "html" "css" "scss" "sass" "less"
  "json" "md" "txt"
  "yml" "yaml"
  "sh"
  "env.example"
)

# Directories to skip.
SKIP_DIRS=(
  ".git"
  "node_modules"
  "dist"
  "build"
  ".vite"
  ".next"
  "coverage"
  "tmp"
  "temp"
)

# Large generated/backup files to skip.
SKIP_NAME_PATTERNS=(
  "*.bak"
  "*.bak-*"
  "*.zip"
  "*.png"
  "*.jpg"
  "*.jpeg"
  "*.webp"
  "*.gif"
  "*.glb"
  "*.gltf"
  "*.fbx"
  "*.mp3"
  "*.wav"
  "*.mp4"
  "*.mov"
  "$OUT"
)

# Max file size in bytes. Default 1 MiB per text file to avoid accidentally dumping huge bundles.
MAX_SIZE="${MAX_SIZE:-1048576}"

should_skip_path() {
  local path="$1"
  for dir in "${SKIP_DIRS[@]}"; do
    if [[ "$path" == */"$dir"/* || "$path" == "./$dir"/* ]]; then
      return 0
    fi
  done
  for pat in "${SKIP_NAME_PATTERNS[@]}"; do
    case "$(basename "$path")" in
      $pat) return 0 ;;
    esac
  done
  return 1
}

has_allowed_extension() {
  local file="$1"
  local base="$(basename "$file")"
  for ext in "${EXTENSIONS[@]}"; do
    if [[ "$base" == *".$ext" || "$base" == "$ext" ]]; then
      return 0
    fi
  done
  return 1
}

is_probably_text() {
  local file="$1"
  # grep -Iq returns true for files that look text-like.
  grep -Iq . "$file"
}

{
  echo "# Combined Project Source Bundle"
  echo "# Root: $ROOT"
  echo "# Generated: $(date -Iseconds)"
  echo "#"
  echo "# Included extensions: ${EXTENSIONS[*]}"
  echo "# Skipped dirs: ${SKIP_DIRS[*]}"
  echo "# Max file size: $MAX_SIZE bytes"
  echo
} > "$OUT"

count=0
skipped_large=0
skipped_binary=0

# Use find with null separators for safe filenames.
while IFS= read -r -d '' file; do
  rel="./${file#./}"

  if should_skip_path "$rel"; then
    continue
  fi

  if ! has_allowed_extension "$rel"; then
    continue
  fi

  size="$(wc -c < "$file" | tr -d ' ')"
  if [[ "$size" -gt "$MAX_SIZE" ]]; then
    {
      echo
      echo "===== SKIPPED LARGE FILE: $rel ($size bytes) ====="
    } >> "$OUT"
    skipped_large=$((skipped_large + 1))
    continue
  fi

  if ! is_probably_text "$file"; then
    {
      echo
      echo "===== SKIPPED NON-TEXT FILE: $rel ====="
    } >> "$OUT"
    skipped_binary=$((skipped_binary + 1))
    continue
  fi

  {
    echo
    echo "===== FILE: $rel ====="
    echo "----- SIZE: $size bytes -----"
    cat "$file"
    echo
  } >> "$OUT"

  count=$((count + 1))
done < <(find . -type f -print0 | sort -z)

{
  echo
  echo "# End of bundle"
  echo "# Files included: $count"
  echo "# Large files skipped: $skipped_large"
  echo "# Binary/non-text files skipped: $skipped_binary"
} >> "$OUT"

echo "Wrote $OUT"
echo "Files included: $count"
echo "Large files skipped: $skipped_large"
echo "Binary/non-text files skipped: $skipped_binary"
