#!/usr/bin/env bash
# QSD FULL RUNTIME AUDIT — read-only, deterministic
# Deps: curl, jq, grep, sed, awk, node, git, lsof (optional) or ss
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
REPORTS_DIR="${REPO_ROOT}/qa/runtime/reports"
TS="$(date -u +"%Y%m%dT%H%M%SZ")"
REPORT_FILE="${REPORTS_DIR}/runtime_audit_${TS}.md"
PORTS=(3000 3001 3333)

mkdir -p "${REPORTS_DIR}"

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0
CRIT_COUNT=0

pass() { PASS_COUNT=$((PASS_COUNT + 1)); echo "PASS: $*"; }
warn() { WARN_COUNT=$((WARN_COUNT + 1)); echo "WARN: $*"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); echo "FAIL: $*"; }
crit() { CRIT_COUNT=$((CRIT_COUNT + 1)); echo "CRITICAL: $*"; }

exec > >(tee "${REPORT_FILE}")
exec 2>&1

echo "# QSD Full Runtime Audit"
echo "**Generated (UTC):** ${TS}"
echo "**Repository:** \`${REPO_ROOT}\`"
echo

echo "## Section A — Environment"
echo '```'
echo "pwd: $(pwd)"
cd "${REPO_ROOT}" || exit 1
echo "repo: ${REPO_ROOT}"
echo "branch: $(git branch --show-current 2>/dev/null || echo 'n/a')"
echo "commit: $(git log --oneline -n 1 2>/dev/null || echo 'n/a')"
echo "node: $(node -v 2>/dev/null || echo 'node missing')"
echo "npm: $(npm -v 2>/dev/null || echo 'npm missing')"
echo "date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
if command -v vercel >/dev/null 2>&1; then
  echo "vercel: $(vercel --version 2>/dev/null)"
else
  echo "vercel: not in PATH"
  if command -v timeout >/dev/null 2>&1; then
    timeout 20 npx --yes vercel --version 2>/dev/null | sed 's/^/vercel (npx): /' || echo "vercel (npx): unavailable or timeout"
  else
    npx --yes vercel --version 2>/dev/null | sed 's/^/vercel (npx): /' || echo "vercel (npx): unavailable"
  fi
fi
echo '```'
echo

echo "## Section B — Port detection (3000 / 3001 / 3333)"
echo '```'
if command -v lsof >/dev/null 2>&1; then
  for p in "${PORTS[@]}"; do
    echo "--- :${p} ---"
    lsof -i ":${p}" 2>/dev/null | head -n 20 || echo "(no listeners or permission denied)"
  done
else
  echo "lsof not available; trying ss -tlnp"
  ss -tlnp 2>/dev/null | grep -E ':3000|:3001|:3333' || echo "(ss produced no match)"
fi
echo '```'
echo

echo "## Section C — API health"
API_FAIL=0
for port in "${PORTS[@]}"; do
  base="http://127.0.0.1:${port}"
  for path in "/api/rank?limit=5" "/api/feeds?cat=portada"; do
    url="${base}${path}"
    echo "### ${url}"
    raw="$(curl -g -sS -o /tmp/qsd_audit_body.json -w '%{http_code}' --max-time 12 "${url}" 2>/dev/null)" || raw=""
    code="${raw: -3}"
    [[ "$code" =~ ^[0-9]{3}$ ]] || code="000"
    sz="$(wc -c < /tmp/qsd_audit_body.json 2>/dev/null | tr -d ' ')"
    echo "- HTTP: ${code}"
    echo "- bytes: ${sz}"
    if [[ "${code}" != "200" ]]; then
      fail "non-200 for ${url}"
      API_FAIL=1
      echo '```'
      head -c 200 /tmp/qsd_audit_body.json 2>/dev/null || true
      echo '```'
      continue
    fi
    if ! jq empty /tmp/qsd_audit_body.json 2>/dev/null; then
      fail "invalid JSON ${url}"
      API_FAIL=1
      continue
    fi
    pass "valid JSON ${url}"
    ic="$(jq '.items | length' /tmp/qsd_audit_body.json 2>/dev/null || echo 0)"
    echo "- items count: ${ic}"
    tit="$(jq -r '.items[0].title // .items[0].headline // empty' /tmp/qsd_audit_body.json 2>/dev/null | head -c 120)"
    echo "- first title snippet: ${tit}"
    if [[ "${ic}" == "0" ]]; then
      warn "zero items ${url}"
    fi
  done
done
echo

echo "## Section D — Rank quality (first responding port with valid rank)"
RANK_PORT=""
for port in "${PORTS[@]}"; do
  raw="$(curl -g -sS -o /tmp/qsd_rank.json -w '%{http_code}' --max-time 12 "http://127.0.0.1:${port}/api/rank?limit=15" 2>/dev/null)" || raw=""
  rc="${raw: -3}"
  [[ "$rc" =~ ^[0-9]{3}$ ]] || rc="000"
  if [[ "$rc" == "200" ]] && jq empty /tmp/qsd_rank.json 2>/dev/null; then
    RANK_PORT="${port}"
    break
  fi
done
if [[ -z "${RANK_PORT}" ]]; then
  fail "no port returned valid /api/rank JSON — skipping rank quality block"
else
  echo "Using port **${RANK_PORT}** for rank payload."
  export QSD_RANK_JSON=/tmp/qsd_rank.json
  node <<'NODE'
const fs = require('fs');
const p = process.env.QSD_RANK_JSON;
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
const items = (j.items || []).slice(0, 10);
let missingTitle = 0, nanScore = 0;
const urls = [], titles = [];
let sumScore = 0, sumFresh = 0, n = 0;
const catHist = {};
for (const it of items) {
  if (!it.title || String(it.title).trim() === '') missingTitle++;
  const s = it.editorial_score;
  if (typeof s !== 'number' || Number.isNaN(s)) nanScore++;
  else { sumScore += s; n++; }
  const h = it.hours_since_publish;
  if (typeof h === 'number' && !Number.isNaN(h)) sumFresh += h;
  const cat = it.category || it.edition || '(none)';
  catHist[cat] = (catHist[cat] || 0) + 1;
  if (it.url) urls.push(it.url);
  if (it.title) titles.push(String(it.title).toLowerCase().trim());
  const need = ['title', 'editorial_score', 'factos_final', 'publishedAt', 'source'];
  const miss = need.filter(k => it[k] === undefined || it[k] === null || it[k] === '');
  if (miss.length) console.log('WARN item field gaps:', (it.title || '').slice(0, 40), miss.join(','));
}
const dupUrl = urls.filter((u, i) => urls.indexOf(u) !== i);
const dupTitle = titles.filter((t, i) => titles.indexOf(t) !== i);
console.log('--- metrics (n=' + items.length + ') ---');
console.log('avg editorial_score:', n ? (sumScore / n).toFixed(4) : 'n/a');
console.log('avg hours_since_publish:', items.length ? (sumFresh / items.length).toFixed(2) : 'n/a');
console.log('category/edition distribution:', JSON.stringify(catHist));
console.log('missing titles:', missingTitle);
console.log('NaN editorial_score:', nanScore);
console.log('dup URLs in sample:', [...new Set(dupUrl)].length);
console.log('dup titles in sample:', [...new Set(dupTitle)].length);
NODE
fi
echo

echo "## Section E — Service worker (repo file)"
SW="${REPO_ROOT}/service-worker.js"
if [[ ! -f "${SW}" ]]; then
  crit "service-worker.js missing"
else
  if grep -q "qsd-pwa-v0.0.7" "${SW}"; then
    pass "CACHE key qsd-pwa-v0.0.7 present"
  else
    crit "CACHE key qsd-pwa-v0.0.7 NOT found (bump drift?)"
  fi
  if grep -qE "cache\.put\(['\"]/?['\"]" "${SW}" || grep -q "cache.put(\`/\`" "${SW}" || grep -q "cache.put('/'," "${SW}"; then
    crit "cache.put on document shell detected"
  else
    pass "no cache.put('/') pattern in service-worker.js"
  fi
  if grep -q "offline.html" "${SW}"; then
    pass "offline fallback referenced"
  else
    fail "offline.html not referenced in SW"
  fi
fi
echo

echo "## Section F — Frontend HTML (live ports)"
HASH_FILE=/tmp/qsd_html_hashes.txt
: > "${HASH_FILE}"
for port in "${PORTS[@]}"; do
  out="/tmp/qsd_home_${port}.html"
  raw="$(curl -sS -o "${out}" -w '%{http_code}' --max-time 12 "http://127.0.0.1:${port}/" 2>/dev/null)" || raw=""
  code="${raw: -3}"
  [[ "$code" =~ ^[0-9]{3}$ ]] || code="000"
  echo "### Port ${port} (/) HTTP ${code}"
  if [[ "${code}" != "200" ]]; then
    warn "homepage not 200 on ${port}"
    continue
  fi
  shasum="$(sha1sum "${out}" | awk '{print $1}')"
  echo "${port} ${shasum}" >> "${HASH_FILE}"
  if grep -q "qsd-signal-terminal" "${out}"; then pass "marker qsd-signal-terminal"; else warn "missing qsd-signal-terminal"; fi
  if grep -qE "site-brand-text|Qué Se Dice|QUE SE DICE" "${out}"; then pass "branding marker"; else warn "weak branding markers"; fi
  if grep -qi "redacci[oó]n QSD|redaccionTitle|redaccionList" "${out}"; then pass "Redacción block marker"; else warn "Redacción QSD markers not found in initial HTML (may be JS-only)"; fi
  if grep -qi "RIMI" "${out}"; then pass "RIMI mention in HTML"; else warn "RIMI not in initial HTML (expected if only in redacción notes)"; fi
  if grep -q "#f5f2ec\|#F5F2EC\|beige" "${out}"; then warn "possible legacy light tokens in HTML"; else pass "no obvious beige token string"; fi
  if grep -q "Cargando noticias" "${out}"; then pass "loading shell present"; else warn "missing loading copy"; fi
  if grep -q "Error al cargar noticias" "${out}" && ! grep -q "Cargando noticias" "${out}"; then warn "error state text without loader (unusual)"; true; fi
done
echo

echo "## Section J — HTML hash consistency (live)"
if [[ ! -s "${HASH_FILE}" ]]; then
  warn "no successful homepage fetches — cannot compare hashes"
else
  uniq_hashes="$(awk '{print $2}' "${HASH_FILE}" | sort -u | wc -l | tr -d ' ')"
  echo '```'
  cat "${HASH_FILE}"
  echo "unique SHA1 count: ${uniq_hashes}"
  echo '```'
  if [[ "${uniq_hashes}" -gt 1 ]]; then
    crit "MULTIPLE FRONTEND REALITIES DETECTED (different SHA1 across ports)"
  else
    pass "single HTML hash across responding ports (or one port only)"
  fi
fi
echo

echo "## Section G — Cache headers (first live port)"
LIVE=""
for port in "${PORTS[@]}"; do
  raw="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${port}/" 2>/dev/null)" || raw=""
  c="${raw: -3}"
  [[ "$c" =~ ^[0-9]{3}$ ]] || c="000"
  if [[ "${c}" == "200" ]]; then LIVE="${port}"; break; fi
done
if [[ -z "${LIVE}" ]]; then
  warn "no live port for header audit"
else
  for path in "/service-worker.js" "/" "/api/rank?limit=3"; do
    echo "### http://127.0.0.1:${LIVE}${path}"
    curl -sSI --max-time 10 "http://127.0.0.1:${LIVE}${path}" 2>/dev/null | grep -iE '^(cache-control|etag|pragma):' || echo "(no cache headers matched)"
    cc="$(curl -sSI --max-time 10 "http://127.0.0.1:${LIVE}${path}" 2>/dev/null | grep -i '^cache-control:' || true)"
    if [[ "${path}" == "/service-worker.js" ]]; then
      if echo "${cc}" | grep -qi 'no-store\|no-cache'; then pass "SW cache-control looks revalidate-friendly"; else warn "SW may be long-cached (check Cache-Control)"; fi
    fi
    if echo "${cc}" | grep -qi 'immutable'; then warn "immutable on ${path}"; fi
  done
fi
echo

echo "## Section H — RQSD"
for port in "${PORTS[@]}"; do
  rq="${REPO_ROOT}/rqsd/index.html"
  echo "### http://127.0.0.1:${port}/rqsd/"
  raw="$(curl -sS -o /tmp/qsd_rqsd.html -w '%{http_code}' --max-time 12 "http://127.0.0.1:${port}/rqsd/" 2>/dev/null)" || raw=""
  code="${raw: -3}"
  [[ "$code" =~ ^[0-9]{3}$ ]] || code="000"
  echo "- HTTP: ${code}"
  if [[ "${code}" == "200" ]]; then
    if grep -q "loadCandidates" /tmp/qsd_rqsd.html && grep -q "api/rank" /tmp/qsd_rqsd.html; then pass "RQSD script references rank API"; else warn "unexpected RQSD markup"; fi
    if grep -q "candidatesEl\|id=\"candidates" /tmp/qsd_rqsd.html; then pass "candidate rail present in HTML"; else warn "candidate container id unclear"; fi
    if grep -q "iframe\|sourceFrame" /tmp/qsd_rqsd.html; then pass "iframe zone marker"; else warn "iframe marker missing"; fi
    if grep -q "preview\|updatePreview" /tmp/qsd_rqsd.html; then pass "preview zone marker"; else warn "preview marker missing"; fi
  else
    warn "RQSD not served on port ${port}"
  fi
done
echo

echo "## Section I — Git state"
echo '```'
git -C "${REPO_ROOT}" status -sb 2>/dev/null || echo "git status failed"
echo '```'
if git -C "${REPO_ROOT}" diff --name-only 2>/dev/null | grep -qE '^service-worker\.js$|^vercel\.json$'; then
  warn "dirty service-worker.js or vercel.json (uncommitted)"
fi
echo

echo "## Topology (local)"
echo "| Port | Role (expected) |"
echo "|------|-----------------|"
echo "| 3000 | \`npm run dev\` → \`vercel dev\` |"
echo "| 3001 | alternate / second dev |"
echo "| 3333 | common \`vercel dev --listen 3333\` |"
echo
echo "## Recommendations"
echo "- Use **\`vercel dev\`** for APIs; **\`serve\`** alone will FAIL Section C."
echo "- One active dev port avoids Section J CRITICAL drift."
echo "- After SW changes: bump \`CACHE\` and verify Section E."
echo

echo "======================================"
echo "QSD RUNTIME AUDIT COMPLETE"
echo "======================================"
OVERALL="PASS"
if [[ "${CRIT_COUNT}" -gt 0 ]]; then OVERALL="FAIL"
elif [[ "${FAIL_COUNT}" -gt 0 ]] || [[ "${API_FAIL}" -eq 1 ]]; then OVERALL="FAIL"
elif [[ "${WARN_COUNT}" -gt 0 ]]; then OVERALL="WARN"
fi
echo "STATUS: ${OVERALL}"
echo "Signals: PASS=${PASS_COUNT} WARN=${WARN_COUNT} FAIL=${FAIL_COUNT} CRITICAL=${CRIT_COUNT}"
echo "Report file: ${REPORT_FILE}"
