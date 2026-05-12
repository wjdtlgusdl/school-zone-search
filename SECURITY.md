# 보안 정책

## 보안 원칙

이 웹앱은 정적 파일 기반으로 동작하며 개인정보를 수집하지 않는 구조를 기본 원칙으로 한다.

- 서버 애플리케이션 없음
- DB 없음
- 로그인/회원가입 없음
- 관리자 페이지 없음
- 외부 API 호출 없음
- 사용자 검색어 저장 없음

## 보안 점검

배포 전 다음 명령을 실행한다.

```bash
npm run check
npm run smoke
npm run audit:security
npm run audit:free-tier
```

데이터 갱신 시에는 다음 순서로 진행한다.

```bash
npm run build:data
npm run smoke
npm run audit:security
npm run audit:free-tier
```

## 무과금 운영 보안

운영 비용이 발생하지 않도록 다음 원칙을 유지한다.

- Cloudflare Pages Free 플랜만 사용
- Workers, Pages Functions, KV, R2, D1 미사용
- GitHub Actions는 표준 Linux runner만 사용
- GitHub Actions artifact/cache/larger runner 미사용
- 외부 유료 SaaS, 유료 모니터링, 유료 분석 도구 미사용

무료 한도 점검은 `npm run audit:free-tier`로 수행한다.

## 민감정보 관리

다음 정보는 저장소에 커밋하지 않는다.

- 개인정보
- 계정 비밀번호
- API 토큰
- Cloudflare 토큰
- GitHub 토큰
- 내부망 구성도
- 내부 IP 현황
- 비공개 문서
- 원본 자료 중 공개 승인되지 않은 자료

원본 자료는 `source_data/`에 보관하며 `.gitignore`로 GitHub 커밋 대상에서 제외한다.

## 취약점 또는 오류 발견 시

운영 담당자 또는 정보보안담당관에게 다음 내용을 전달한다.

- 발견 일시
- 재현 방법
- 영향 범위
- 화면 캡처 또는 오류 메시지
- 사용 브라우저 및 기기

## 배포 롤백

오배포 또는 보안 문제가 발생하면 Cloudflare Pages의 이전 정상 배포로 롤백한다.

1. Cloudflare Dashboard 접속
2. `Workers & Pages` 선택
3. 해당 Pages 프로젝트 선택
4. `Deployments`에서 이전 정상 배포 선택
5. Rollback 또는 Redeploy 실행

## 운영 권고

- GitHub MFA 적용
- Cloudflare MFA 적용
- 저장소 접근권한 최소화
- Cloudflare GitHub 앱 권한을 해당 저장소로 제한
- `main` 브랜치 보호 규칙 적용
- 데이터 갱신 이력 관리
- 월 1회 접근권한 점검
