# DevLens

Chrome 확장 프로그램 — 웹 이미지/동영상 분석 및 다운로드 도구

## 기능

### 이미지 분석
- **Cmd(Ctrl)+클릭**으로 페이지 내 이미지 선택
- EXIF 메타데이터 파싱 (카메라, 렌즈, 촬영 설정, GPS 등)
- XMP / IPTC 메타데이터 추출
- 파일 포맷, 크기, 해상도, 렌더 크기 표시
- HTTP 응답 헤더 전체 표시
- Base64 이미지 지원 (소스 타입 표시)

### 이미지 오버레이
- 페이지 내 이미지에 파일 크기/상태 뱃지 오버레이 표시
- 로딩 상태, 에러 여부 시각적 확인

### 접근 권한 분석
- **Signed URL 감지** — AWS S3, GCP, Azure SAS, 일반 서명 파라미터 자동 분류
- **쿠키 필요 여부** — `credentials: omit` 실제 fetch 테스트 + 매직바이트 검증
- **인증 쿠키 목록** — `chrome.cookies` API로 도메인 인증 쿠키 조회
- CORS 정책, 캐시 정책, CDN 식별 (CloudFront, Cloudflare, Fastly, Akamai 등)

### URL 파라미터 분석
- CDN별 이미지 품질/크기 파라미터 자동 감지
  - 쿼리 파라미터 (`w`, `h`, `q`, `format` 등)
  - Cloudinary (`/c_fill,w_800,q_80/`)
  - Google/YouTube (`=s800`, `=w800-h600`)
  - Naver (`?type=w966`)
  - WordPress (`-800x600.jpg`)
  - Shopify (`_800x.jpg`)
  - 경로 내 크기 (`/800x600/`)
- 슬라이더/입력으로 값 조절 및 미리보기
- **최고 화질** 버튼 — CDN별 최적 파라미터 자동 설정
- 변경 결과 비교 (용량/해상도 비교 배너 + 유지/되돌리기)

### 다운로드
- 이미지 다운로드 (원본 포맷 유지 또는 변환)
- 자동 저장 옵션 (하위폴더 지정, GIF/동영상 자동 다운로드)
- 저장 경로 toast 표시
- cURL 명령어 생성 및 복사
- 이미지 클립보드 복사 (PNG 변환)

### 동영상
- Cmd+클릭으로 `<video>` 선택
- HLS (m3u8) / 직접 URL 다운로드
- **OPFS 스트리밍** — 1GB 이상 영상도 메모리 부족 없이 다운로드
- 프레임 캡처 미리보기 (blob URL) / 플레이어 미리보기 (직접 URL)
- 동영상 cURL 생성

### API Checker
- Swagger / OpenAPI 스펙 URL 등록
- 네트워크 요청 실시간 캡처 (Chrome Debugger Protocol)
- 요청을 등록된 API 스펙 엔드포인트에 자동 매칭
- 매칭 결과 타임라인 뷰 (시간순 요청 흐름 시각화)
- 매칭/미매칭 필터링 및 상세 정보 표시

### 갤러리
- 다운로드 이력 조회 페이지
- 저장된 이미지/동영상 목록 확인

## 설치

### 개발 환경

```bash
pnpm install
pnpm dev        # 개발 모드 (HMR)
pnpm build      # 프로덕션 빌드
```

### Chrome에 로드

1. `pnpm build` 실행
2. `chrome://extensions` 열기
3. **개발자 모드** 활성화
4. **압축해제된 확장 프로그램을 로드합니다** 클릭
5. `.output/chrome-mv3` 폴더 선택

## 사용법

1. 확장 아이콘 클릭 → 사이드패널 열기
2. **Cmd**(Mac) 또는 **Ctrl**(Windows) 키를 누른 채 이미지/동영상 클릭
3. 사이드패널에서 분석 결과 확인

## 파일 구조

```
├── entrypoints/
│   ├── background/          # 서비스 워커 (메시지 라우팅, API Checker)
│   ├── content/             # 콘텐츠 스크립트 (이미지/비디오 선택, 오버레이)
│   ├── content-sniffer.ts   # MAIN world 스크립트 (HLS/DASH URL 캡처)
│   ├── sidepanel/           # 사이드패널 React UI
│   ├── gallery/             # 갤러리 페이지
│   └── offscreen/           # 오프스크린 문서 (영상 다운로드)
├── src/
│   ├── features/
│   │   ├── api-checker/     # API Checker 기능 (스펙 파싱, 매칭, UI)
│   │   └── devlens/         # DevLens 핵심 기능 (분석, 다운로드)
│   └── shared/              # 공용 유틸리티, 타입
├── wxt.config.ts            # WXT 빌드 설정
├── tailwind.config.js       # Tailwind CSS 설정
└── package.json
```

## 기술 스택

- **WXT** — 크로스 브라우저 확장 프레임워크
- **React 19** + **TypeScript** — UI 및 타입 안전성
- **Tailwind CSS** — 스타일링
- **Zustand** — 상태 관리
- **Vitest** — 테스트
- Chrome Extension Manifest V3
- Side Panel API, OPFS (Origin Private File System)
- Content Scripts (ISOLATED + MAIN world)
- `chrome.cookies`, `chrome.downloads`, `chrome.debugger`
