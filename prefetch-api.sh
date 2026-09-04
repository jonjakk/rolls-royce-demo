#!/bin/bash
# Pre-fetch all configurator API responses using curl (which works with Akamai)
# and cache them locally so the proxy server can serve them without hitting the live API

SITE_DIR="$(dirname "$0")/site"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

fetch() {
  local url="$1"
  local domain=$(echo "$url" | sed -E 's|https?://([^/]+).*|\1|')
  local path=$(echo "$url" | sed -E 's|https?://[^/]+(/.*)|\1|')
  local local_path="${SITE_DIR}/${domain}${path}"
  local dir=$(dirname "$local_path")

  mkdir -p "$dir"
  echo "  Fetching: $domain$path"
  curl -s --connect-timeout 15 -H "User-Agent: $UA" -H "Accept: */*" -H "Accept-Language: en-GB,en;q=0.9" "$url" -o "$local_path"
  local size=$(wc -c < "$local_path" 2>/dev/null | tr -d ' ')
  echo "    -> ${size} bytes saved to $local_path"
}

fetch_post() {
  local url="$1"
  local data="$2"
  local domain=$(echo "$url" | sed -E 's|https?://([^/]+).*|\1|')
  local path=$(echo "$url" | sed -E 's|https?://[^/]+(/.*)|\1|')
  local local_path="${SITE_DIR}/${domain}${path}"
  local dir=$(dirname "$local_path")

  mkdir -p "$dir"
  echo "  POST: $domain$path"
  curl -s --connect-timeout 15 -X POST -H "User-Agent: $UA" -H "Content-Type: application/json" -H "Accept: */*" -d "$data" "$url" -o "$local_path"
  local size=$(wc -c < "$local_path" 2>/dev/null | tr -d ' ')
  echo "    -> ${size} bytes"
}

echo "=== Pre-fetching configurator API data ==="
echo ""

# 1. Model selection variants
echo "1. Model variants..."
fetch "https://api.visualiser.rolls-roycemotorcars.com/variants?filter=modelSelection&country=gb"

# 2. i18n translations
echo "2. Translations..."
fetch "https://visualiser.rolls-roycemotorcars.com/assets/i18n/en.json"

# 3. Visualiser web component scripts
echo "3. Web component scripts..."
fetch "https://visualiser.rolls-roycemotorcars.com/web-component/model-selection/scripts.js"
fetch "https://visualiser.rolls-roycemotorcars.com/web-component/model-selection/runtime.js"
fetch "https://visualiser.rolls-roycemotorcars.com/web-component/model-selection/polyfills.js"
fetch "https://visualiser.rolls-roycemotorcars.com/web-component/model-selection/main.js"
fetch "https://visualiser.rolls-roycemotorcars.com/web-component/model-selection/styles.css"

# 4. Per-model UI configs and specs
echo "4. Per-model configs..."
MODELS="Phantom/RR11 Phantom/RR12 Spectre/RR25 Spectre/RR25BB Ghost/RR21 Ghost/RR22 Ghost/RR21BB Cullinan/RR31 Cullinan/RR31BB"
for model in $MODELS; do
  fetch "https://visualiser.rolls-roycemotorcars.com/assets/data/${model}/ui.json"
  fetch "https://visualiser.rolls-roycemotorcars.com/assets/data/${model}/inspired-specs.json"
done

# 5. Model selection images (profile views)
echo "5. Model images..."
for model in $MODELS; do
  derivative=$(echo "$model" | cut -d/ -f1)
  range=$(echo "$model" | cut -d/ -f2)
  fetch "https://visualiser.rolls-roycemotorcars.com/assets/data/${model}/profile.png"
  fetch "https://visualiser.rolls-roycemotorcars.com/assets/data/${model}/emissions_small.png"
done

# 6. Emissions data (POST)
echo "6. Emissions data..."
# Get the model IDs from variants response
VARIANT_IDS=$(cat "${SITE_DIR}/api.visualiser.rolls-roycemotorcars.com/variants" 2>/dev/null | python3 -c "
import json, sys
try:
  data = json.load(sys.stdin)
  ids = [v['id'] for v in data.get('variants', [])]
  print(' '.join(ids))
except: pass
" 2>/dev/null)

if [ -n "$VARIANT_IDS" ]; then
  for vid in $VARIANT_IDS; do
    BODY="{\"modelRange\":\"${vid}\",\"country\":\"gb\"}"
    fetch_post "https://api.visualiser.rolls-roycemotorcars.com/emissions" "$BODY"
  done
fi

# 7. BMW consent/epaas files
echo "7. Consent framework..."
fetch "https://www.bmw.com/epaas/prod/consentcontroller/rolls-roycemotorcars_com/v94x32x694x12x10x35x24x43x33x55x5x3336x5x0.epaas.json"
fetch "https://www.bmw.com/etc/clientlibs/wcmp/consentcontroller.fallback/epaas.js"
fetch "https://www.bmw.com/p15r.js?tenant=rolls-roycemotorcars_com"

echo ""
echo "=== Done ==="
echo "All API responses cached locally."
