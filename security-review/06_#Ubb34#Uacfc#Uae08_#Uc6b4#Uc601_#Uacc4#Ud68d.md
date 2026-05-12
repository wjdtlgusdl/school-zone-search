# 무과금 운영 계획

본 문서는 `화성오산 초등학교 통학구역 조회` 웹앱을 GitHub와 Cloudflare Pages에서 비용 없이 운영하기 위한 기준과 점검 절차를 정리한다.

## 1. 운영 원칙

- Cloudflare Pages Free 플랜만 사용한다.
- GitHub Free 범위 안에서만 사용한다.
- 서버, DB, Workers, Pages Functions, KV, R2, 유료 Analytics 등 과금 가능 기능을 사용하지 않는다.
- GitHub Actions는 최소 검증 용도로만 사용하고 artifact, cache, larger runner를 사용하지 않는다.
- 배포 전 `npm run audit:free-tier`를 실행하여 무료 한도 초과 가능성을 확인한다.
- 비용 발생 가능성이 있는 설정을 켜야 하는 경우 배포 전에 기관 승인 절차를 거친다.

## 2. 확인한 공식 무료 한도

확인일: 2026-05-11

### GitHub Actions

공식 문서 기준:

- 공개 저장소의 표준 GitHub-hosted runner 사용은 무료
- 비공개 저장소의 GitHub Free 계정은 월 2,000분, artifact storage 500MB, cache storage 10GB 포함
- larger runner는 무료 한도와 별개로 과금 대상

본 프로젝트 적용:

- `ubuntu-latest` 표준 runner만 사용
- `timeout-minutes: 5` 적용
- artifact 업로드 없음
- cache 사용 없음
- dependency 설치 없음
- 변경 경로 제한 적용
- 동시에 여러 검사가 중복 실행되지 않도록 `concurrency` 적용

### Cloudflare Pages

공식 문서 기준:

- Free 플랜 Pages builds: 월 500회
- Free 플랜 Pages files: 사이트당 20,000개
- 단일 asset 최대 크기: 25MiB
- Static asset requests: 무료 및 제한 없음
- Pages Functions 요청은 Workers Free quota에 포함

본 프로젝트 적용:

- `public/` 정적 파일만 배포
- Pages Functions 미사용
- Workers 미사용
- 현재 데이터 파일은 단일 파일 25MiB 미만으로 관리
- 빌드 명령 없음 또는 `exit 0`
- 배포 결과물 경로는 `public`

## 3. 금지 또는 주의 설정

| 구분 | 정책 |
| --- | --- |
| Cloudflare Workers | 사용하지 않음 |
| Cloudflare Pages Functions | 사용하지 않음 |
| Cloudflare KV/R2/D1/Durable Objects | 사용하지 않음 |
| Cloudflare 유료 플랜 | 사용하지 않음 |
| GitHub larger runner | 사용하지 않음 |
| GitHub Actions artifact/cache | 사용하지 않음 |
| GitHub Packages | 사용하지 않음 |
| 외부 SaaS 모니터링 | 유료 서비스 사용 금지 |
| 결제수단 등록 | 필요하지 않으면 등록하지 않음 |

## 4. 자동 점검

배포 전 다음 명령을 실행한다.

```bash
npm run check
npm run smoke
npm run audit:security
npm run audit:free-tier
```

`npm run audit:free-tier`는 다음 항목을 확인한다.

- `public/` 파일 수가 20,000개 이하인지 확인
- 단일 배포 파일이 25MiB 이하인지 확인
- Workers 또는 Pages Functions 관련 파일이 없는지 확인

## 5. GitHub Actions 운영 기준

현재 워크플로:

- `.github/workflows/quality-check.yml`

실행 조건:

- `main` 브랜치 push
- `main` 브랜치 대상 pull request
- 수동 실행

비용 방지 설정:

- 표준 Linux runner 사용
- 최대 실행 시간 5분 제한
- artifact/cache 미사용
- 앱 관련 경로가 바뀐 경우에만 자동 실행
- 같은 브랜치에서 중복 실행 시 이전 실행 취소

비공개 저장소로 운영하는 경우:

- 월 2,000분 한도 내에서 운영되는지 GitHub Billing 화면을 월 1회 확인한다.
- 대량 커밋 또는 반복 실패로 사용량이 급증하면 Actions를 일시 중지한다.
- 결제수단이 등록되어 있다면 예산 또는 사용 알림을 0원 또는 최소 금액으로 설정한다.

## 6. Cloudflare Pages 운영 기준

Cloudflare Pages 설정:

| 항목 | 값 |
| --- | --- |
| Plan | Free |
| Framework preset | None |
| Production branch | main |
| Build command | 비움 또는 `exit 0` |
| Build output directory | public |
| Functions | 사용 안 함 |
| Workers bindings | 사용 안 함 |

운영 주의:

- 월 500 builds를 넘지 않도록 불필요한 push를 줄인다.
- 대량 데이터 갱신 전 로컬에서 먼저 테스트한다.
- 단일 파일이 25MiB를 넘으면 데이터를 분할하거나 데이터 범위를 재검토한다.
- Cloudflare 유료 플랜, R2, Workers Paid, 유료 Analytics를 활성화하지 않는다.

## 7. 공식 문서

- GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/
- Cloudflare Pages pricing: https://developers.cloudflare.com/pages/functions/pricing/
