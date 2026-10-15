#!/bin/zsh -l
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  print 'Node.js 22 이상이 필요합니다. 설치 후 다시 실행해 주세요.'
  read -k 1
  exit 1
fi
if [[ ! -f out/index.html ]]; then
  print '빌드가 없습니다. npm ci 후 npm run build를 실행해 주세요.'
  read -k 1
  exit 1
fi
print 'ASTRAYON — 브라우저에서 http://127.0.0.1:4173 을 여세요.'
print '이 창에서 Control+C를 누르면 서버가 종료됩니다.'
PORT=4173 node scripts/serve.mjs
