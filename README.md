# DevLens

웹 이미지/동영상 분석 및 다운로드 Chrome 확장 프로그램

## 기능

### 이미지/동영상 분석
- **Cmd(Ctrl)+클릭**으로 이미지 또는 `<video>` 선택
- EXIF / XMP / IPTC 메타데이터 파싱
- 파일 포맷, 크기, 해상도, HTTP 헤더 표시
- 이미지 오버레이 — 파일 크기/상태 뱃지

### 접근 권한 분석
- Signed URL 감지 (AWS S3, GCP, Azure SAS)
- 쿠키 필요 여부 테스트, 인증 쿠키 목록 조회
- CORS/캐시 정책, CDN 식별

### URL 파라미터 편집
- CDN별 품질/크기 파라미터 자동 감지 및 조절
- **최고 화질** 버튼 — CDN별 최적 파라미터 자동 설정
- 변경 전후 용량/해상도 비교

### 다운로드
- 이미지/동영상 다운로드 (자동 저장, 하위폴더 지정)
- HLS(m3u8) 스트리밍, OPFS 기반 대용량 영상 다운로드
- cURL 생성, 클립보드 복사

### API Checker
- Swagger / OpenAPI 스펙 등록 후 네트워크 요청 실시간 매칭
- 타임라인 뷰, 매칭/미매칭 필터링

### 갤러리
- 다운로드 이력 조회

## 설치

```bash
pnpm install
pnpm dev          # 개발 모드 (HMR)
pnpm build        # 프로덕션 빌드
```

빌드 후 `chrome://extensions` → 개발자 모드 → `.output/chrome-mv3` 폴더 로드

## 사용법

1. 확장 아이콘 클릭 → 사이드패널 열기
2. **Cmd**(Mac) / **Ctrl**(Win) + 이미지/동영상 클릭
3. 사이드패널에서 분석 결과 확인

## 기술 스택

WXT · React 19 · TypeScript · Tailwind CSS · Zustand · Vitest · Chrome MV3
