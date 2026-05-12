# 화성시·오산시 초등학교 통학구역 조회

Cloudflare Pages 정적 배포용 웹앱입니다. Streamlit/Python 런타임 없이 브라우저에서 주소와 학교명을 검색합니다.

## 먼저 읽을 파일

GitHub 저장, Cloudflare Pages 배포, 로컬 테스트, 데이터 갱신은 이 파일 `README.md`만 따라 진행하면 됩니다.

보안성검토 제출자료는 `docs/security-review/` 폴더에 따로 정리되어 있습니다. 배포 방법이 궁금한 경우에는 보안성검토 문서가 아니라 현재 파일을 읽으면 됩니다.

## 처음 시작 전 준비

아래 준비가 되어 있어야 GitHub와 Cloudflare Pages로 배포할 수 있습니다.

1. GitHub 계정
   - https://github.com 에서 가입합니다.
   - 코드를 저장할 온라인 저장소를 만드는 곳입니다.

2. Cloudflare 계정
   - https://dash.cloudflare.com 에서 가입합니다.
   - 웹앱을 실제 인터넷 주소로 배포하는 곳입니다.

3. Git 설치
   - 터미널에서 아래 명령을 실행해 확인합니다.

```bash
git --version
```

버전이 보이면 설치된 상태입니다. 명령을 찾을 수 없다고 나오면 Git을 설치해야 합니다.

4. Node.js 설치
   - 로컬 테스트와 검사 명령을 실행하려면 필요합니다.

```bash
node --version
npm --version
```

버전이 보이면 설치된 상태입니다.

5. 터미널 열기
   - Windows: `PowerShell` 또는 `Windows Terminal`
   - macOS: `Terminal`
   - VS Code를 사용한다면 상단 메뉴에서 `Terminal > New Terminal`

터미널을 연 뒤 이 프로젝트 폴더로 이동해서 명령을 실행합니다.

## 로컬 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:8788`을 엽니다.

배포 전 간단 검사는 아래 명령으로 확인합니다.

```bash
npm run check
npm run smoke
npm run audit:security
npm run audit:free-tier
```

`audit:free-tier`는 Cloudflare Pages Free 플랜에서 문제가 될 수 있는 파일 수, 단일 파일 크기, Workers/Pages Functions 사용 여부를 확인합니다.

## GitHub 준비

1. GitHub에서 새 저장소를 만듭니다.
   - GitHub 로그인 후 오른쪽 위 `+` 버튼을 누릅니다.
   - `New repository`를 선택합니다.
   - 예: `hsoselementaryschool`
   - Public/Private는 원하는 방식으로 선택해도 됩니다.
   - `Create repository`를 누릅니다.

2. 이 프로젝트 폴더에서 변경 파일을 커밋합니다.

```bash
git add .
git commit -m "Deploy static Cloudflare Pages app"
```

3. GitHub 저장소 주소를 연결합니다.
   - GitHub 저장소 화면에서 `Code` 버튼을 누릅니다.
   - `HTTPS` 주소를 복사합니다.
   - 예: `https://github.com/사용자명/저장소명.git`

```bash
git branch -M main
git remote add origin https://github.com/사용자명/저장소명.git
git push -u origin main
```

이미 `origin`이 연결되어 있다면 `git remote add origin ...` 대신 아래처럼 주소만 확인하거나 바꿉니다.

```bash
git remote -v
git remote set-url origin https://github.com/사용자명/저장소명.git
git push -u origin main
```

## Cloudflare Pages 배포

Cloudflare 대시보드에서 아래 순서로 진행합니다.

1. `Workers & Pages`로 이동합니다.
2. `Create application` 또는 `Pages를 배포하려고 하십니까? 시작`을 선택합니다.
3. `Pages`를 선택합니다.
4. `Connect to Git` 또는 `Import an existing Git repository`를 선택합니다.
5. GitHub 계정을 연결하고, 위에서 만든 저장소를 선택합니다.
   - 처음 연결할 때 GitHub 권한 승인 화면이 나옵니다.
   - `Authorize Cloudflare Pages` 또는 `Install & Authorize`를 선택합니다.
   - 저장소 접근 범위를 묻는 화면이 나오면 이 프로젝트 저장소를 선택합니다.
   - 조직 계정 저장소라면 조직 관리자 권한이 필요할 수 있습니다.
6. 빌드 설정을 아래처럼 입력합니다.

| 항목 | 값 |
| --- | --- |
| Framework preset | `None` |
| Production branch | `main` |
| Build command | 비워둠 |
| Build output directory | `public` |
| Root directory | 비워둠 또는 저장소 루트 |

7. `Save and Deploy`를 누릅니다.
8. 배포가 끝나면 Cloudflare가 제공하는 `*.pages.dev` 주소로 접속합니다.

만약 Cloudflare 화면에서 Build command를 비워둘 수 없다면 `exit 0`을 입력합니다. 이 프로젝트는 별도 빌드 없이 `public` 폴더를 그대로 배포하는 구조입니다.

배포 성공 여부는 Cloudflare Pages의 배포 로그에서 확인할 수 있습니다. 실패하면 빨간색 또는 Failed 상태가 보이고, 성공하면 배포 주소가 표시됩니다.

## 무과금 운영 기준

이 프로젝트는 최종 운영 비용이 발생하지 않도록 정적 웹앱으로 구성되어 있습니다.

사용 기준:

- Cloudflare Pages Free 플랜 사용
- Cloudflare Workers, Pages Functions, KV, R2, D1 사용 안 함
- GitHub Actions는 표준 Linux runner에서 짧은 검증만 실행
- GitHub Actions artifact/cache 사용 안 함
- 유료 모니터링, 유료 분석, 유료 보안 부가서비스 사용 안 함

무료 한도 확인:

- Cloudflare Pages Free: 월 500 builds, 사이트당 20,000 files, 단일 asset 25MiB 제한
- Cloudflare Pages static asset requests: 무료 및 제한 없음
- GitHub Actions: 공개 저장소의 표준 GitHub-hosted runner는 무료
- GitHub Actions 비공개 저장소: GitHub Free 기준 월 2,000분, artifact storage 500MB, cache storage 10GB 포함

비공개 저장소에서 GitHub Actions를 사용할 경우 사용량을 월 1회 확인하세요. 비용 발생을 원천적으로 피하려면 결제수단을 등록하지 않거나, 결제수단이 이미 있다면 GitHub 예산/알림을 0원 또는 최소 금액으로 설정해 두는 것을 권장합니다.

배포 전 무료 한도 점검은 아래 명령으로 실행합니다.

```bash
npm run audit:free-tier
```

## 배포 후 수정

코드를 수정한 뒤 아래처럼 GitHub에 push하면 Cloudflare Pages가 자동으로 다시 배포합니다.

```bash
git add .
git commit -m "Update app"
git push
```

Cloudflare Pages는 GitHub와 연결된 프로젝트에서 새 커밋이 올라오면 자동으로 배포를 시작합니다.

## 데이터 갱신

원본 자료는 커밋하지 않는 로컬 재생성용 파일입니다. 아래 파일명으로 배치한 뒤 명령을 실행합니다.

- `source_data/tongban.csv`
- `source_data/school_zones_2026.xlsx`
- `source_data/road_osan_hwaseong.csv`

```bash
npm run build:data
npm run smoke
npm run audit:security
npm run audit:free-tier
```

생성되는 배포 데이터는 `public/data/core.json`, `public/data/roads.json`, `public/data/suggestions.json`입니다.

데이터를 갱신했다면 생성된 `public/data/*.json` 파일을 커밋하고 GitHub에 push합니다.

```bash
git add public/data
git commit -m "Update school zone data"
git push
```

## 자주 생기는 문제

### 배포는 됐는데 빈 화면이 보이는 경우

Cloudflare Pages 설정에서 `Build output directory`가 `public`인지 확인합니다.

### 주소 자동완성이 안 나오는 경우

`public/data/suggestions.json`이 GitHub에 올라갔는지 확인합니다.

### 주소 검색이 너무 오래 걸리는 경우

첫 주소 검색 때 `public/data/roads.json`을 불러옵니다. 이 파일은 약 14MB라 모바일 저속 환경에서는 처음 한 번 시간이 걸릴 수 있습니다.

### 배포 전 보안 점검을 하고 싶은 경우

아래 명령을 실행합니다.

```bash
npm run audit:security
npm run audit:free-tier
```

이 명령은 `public/data/*.json`에 이메일, 전화번호, 주민등록번호 형식, 토큰/비밀번호 관련 문자열이 있는지 확인하고, `public/_headers`에 주요 보안 헤더가 있는지 확인합니다.

`audit:free-tier`는 Cloudflare Pages Free 한도에 맞는지 확인합니다.

### 원본 CSV/XLSX 파일이 GitHub에 안 올라가는 경우

정상입니다. `source_data/`는 원본 자료 보관 및 데이터 재생성용이며 `.gitignore`에 포함되어 있습니다. 실제 배포에는 `public/data/*.json`만 필요합니다.

## 참고 문서

- Cloudflare Pages Git integration: https://developers.cloudflare.com/pages/get-started/git-integration/
- Cloudflare Pages GitHub integration: https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/
- Cloudflare Pages static HTML guide: https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
- Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/
- Cloudflare Pages pricing: https://developers.cloudflare.com/pages/functions/pricing/
- GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions
