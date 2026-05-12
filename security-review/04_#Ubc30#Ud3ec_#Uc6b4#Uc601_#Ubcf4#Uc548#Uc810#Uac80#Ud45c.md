# 배포 및 운영 보안점검표

## 1. GitHub 저장소 점검

| 항목 | 상태 | 비고 |
| --- | --- | --- |
| 저장소 접근 권한 최소화 | 확인 필요 | 담당자 외 접근 제한 |
| GitHub MFA 적용 | 확인 필요 | 모든 관리자 계정 |
| 저장소 공개 범위 검토 | 확인 필요 | 가능하면 Private 권고 |
| `source_data/` 커밋 제외 | 반영 | `.gitignore` 적용 |
| 토큰, 비밀번호, 인증키 미포함 | 확인 필요 | 커밋 전 검색 |
| `main` 브랜치 보호 | 권고 | 직접 push 제한 검토 |
| Cloudflare GitHub 앱 권한 최소화 | 확인 필요 | 해당 저장소만 허용 |
| GitHub Actions 표준 Linux runner 사용 | 반영 | `.github/workflows/quality-check.yml` |
| GitHub Actions artifact/cache 미사용 | 반영 | 저장 공간 과금 방지 |
| GitHub Actions 사용량 확인 | 확인 필요 | 비공개 저장소는 월 2,000분 한도 확인 |

## 2. Cloudflare Pages 점검

| 항목 | 상태 | 비고 |
| --- | --- | --- |
| Git 연동 배포 사용 | 반영 | GitHub push 시 자동 배포 |
| Production branch `main` 지정 | 확인 필요 | Cloudflare 설정 확인 |
| Build output directory `public` 지정 | 확인 필요 | 필수 |
| Build command 비움 또는 `exit 0` | 확인 필요 | 정적 배포 |
| HTTPS 적용 | 확인 필요 | Cloudflare 기본 제공 |
| Preview 배포 공개 범위 검토 | 권고 | 필요 시 Preview branch 제한 |
| Cloudflare 계정 MFA 적용 | 확인 필요 | 모든 관리자 계정 |
| 불필요한 Cloudflare 기능 비활성화 | 확인 필요 | Workers/Functions 미사용 |
| Cloudflare Pages Free 플랜 사용 | 확인 필요 | 유료 플랜 사용 금지 |
| Pages Functions 미사용 | 반영 | Functions 요청 quota 사용 방지 |
| Workers/KV/R2/D1 미사용 | 반영 | 과금 가능 기능 배제 |
| 월 500 builds 이하 관리 | 확인 필요 | 불필요한 push 제한 |
| 단일 asset 25MiB 이하 관리 | 반영 | `npm run audit:free-tier` |

## 3. 보안 헤더 점검

`public/_headers`에 다음 헤더가 포함되어야 한다.

| 헤더 | 목적 | 상태 |
| --- | --- | --- |
| `Strict-Transport-Security` | HTTPS 사용 강화 | 반영 |
| `X-Frame-Options` | 클릭재킹 방지 | 반영 |
| `X-Content-Type-Options` | MIME 스니핑 방지 | 반영 |
| `Referrer-Policy` | referrer 정보 최소화 | 반영 |
| `Permissions-Policy` | 브라우저 권한 기능 차단 | 반영 |
| `Cross-Origin-Opener-Policy` | 교차 출처 격리 보강 | 반영 |
| `Cross-Origin-Resource-Policy` | 리소스 교차 출처 사용 제한 | 반영 |
| `Content-Security-Policy` | 외부 리소스 및 스크립트 제한 | 반영 |

## 4. 배포 전 코드 점검

```bash
npm run check
npm run smoke
npm run audit:security
npm run audit:free-tier
```

| 항목 | 상태 | 비고 |
| --- | --- | --- |
| JavaScript 문법 검사 통과 | 확인 필요 | `npm run check` |
| 대표 주소 검색 통과 | 확인 필요 | `npm run smoke` |
| 대표 학교명 검색 통과 | 확인 필요 | `npm run smoke` |
| 자동완성 테스트 통과 | 확인 필요 | `npm run smoke` |
| 개인정보/민감정보 패턴 점검 | 확인 필요 | `npm run audit:security` |
| 보안 헤더 존재 여부 점검 | 확인 필요 | `npm run audit:security` |
| 무료 한도 초과 가능성 점검 | 확인 필요 | `npm run audit:free-tier` |
| 브라우저 수동 테스트 | 확인 필요 | PC/모바일 |
| 다크모드/라이트모드 확인 | 확인 필요 | PC/모바일 |

## 5. 데이터 갱신 점검

| 항목 | 상태 | 비고 |
| --- | --- | --- |
| 원본 자료 출처 확인 | 확인 필요 | 공식 자료 여부 |
| 원본 자료 기준일 기록 | 확인 필요 | 데이터 설명에 반영 |
| 개인정보 포함 여부 점검 | 확인 필요 | 공개 가능 자료만 포함 |
| `source_data/`에 원본 자료 배치 | 확인 필요 | GitHub 커밋 제외 |
| 데이터 생성 실행 | 확인 필요 | `npm run build:data` |
| 생성 JSON 확인 | 확인 필요 | `public/data/*.json` |
| 스모크 테스트 통과 | 확인 필요 | `npm run smoke` |
| 보안 점검 통과 | 확인 필요 | `npm run audit:security` |
| 무료 한도 점검 통과 | 확인 필요 | `npm run audit:free-tier` |
| 생성 JSON만 커밋 | 확인 필요 | 원본 자료 제외 |

## 6. 배포 후 점검

| 항목 | 상태 | 비고 |
| --- | --- | --- |
| Cloudflare Pages 배포 성공 확인 | 확인 필요 | 배포 로그 |
| 운영 URL 접속 확인 | 확인 필요 | HTTPS |
| 주소 조회 확인 | 확인 필요 | 대표 주소 |
| 학교명 조회 확인 | 확인 필요 | 대표 학교명 |
| 자동완성 확인 | 확인 필요 | 주소/학교명 |
| 모바일 화면 확인 | 확인 필요 | iOS/Android |
| 보안 헤더 적용 확인 | 확인 필요 | 브라우저 개발자도구 또는 외부 검사 |
| 무료 플랜 설정 확인 | 확인 필요 | Cloudflare/GitHub billing 화면 |

## 7. 사고 대응 및 롤백

| 상황 | 조치 |
| --- | --- |
| 배포 실패 | Cloudflare 배포 로그 확인 후 수정 커밋 |
| 오배포 | Cloudflare Pages에서 이전 정상 배포로 롤백 |
| 데이터 오류 | 원본 자료 확인 후 `npm run build:data` 재실행 |
| 보안 설정 오류 | `public/_headers` 수정 후 재배포 |
| 계정 유출 의심 | GitHub/Cloudflare 비밀번호 변경, MFA 재설정, 접근권한 회수 |

## 8. 정기 점검 권고

- 월 1회 Cloudflare/GitHub 접근권한 확인
- 데이터 기준일 및 최신성 확인
- 배포 URL 정상 접속 확인
- 보안 헤더 적용 상태 확인
- 원본 자료 보관 위치 및 접근권한 확인
- GitHub Actions 사용량 및 Cloudflare Pages build 횟수 확인
