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

### AI 생성 이미지 감지
- EXIF Software 필드에서 AI 도구 패턴 매칭 (Midjourney, DALL-E, Stable Diffusion, Firefly, FLUX 등 20종)
- XMP CreatorTool / SoftwareAgent 분석
- IPTC DigitalSourceType (`trainedAlgorithmicMedia`) 감지
- PNG tEXt 청크 분석 (Stable Diffusion parameters, prompt 등)
- C2PA Content Credentials (JUMBF/caBX) 감지 및 claim_generator 추출

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
- 자동 저장 옵션
- 저장 경로 toast 표시
- cURL 명령어 생성 및 복사
- 이미지 클립보드 복사 (PNG 변환)

### 동영상
- Cmd+클릭으로 `<video>` 선택
- HLS (m3u8) / 직접 URL 다운로드
- **OPFS 스트리밍** — 1GB 이상 영상도 메모리 부족 없이 다운로드
- 프레임 캡처 미리보기 (blob URL) / 플레이어 미리보기 (직접 URL)
- 동영상 cURL 생성

## 설치

1. `chrome://extensions` 열기
2. **개발자 모드** 활성화
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. 이 폴더 선택

## 사용법

1. 확장 아이콘 클릭 → 사이드패널 열기
2. **Cmd**(Mac) 또는 **Ctrl**(Windows) 키를 누른 채 이미지/동영상 클릭
3. 사이드패널에서 분석 결과 확인

## 파일 구조

```
├── manifest.json      # 확장 설정 (MV3)
├── background.js      # 서비스 워커 (이미지 fetch, EXIF/AI 분석)
├── content.js         # 콘텐츠 스크립트 (이미지/비디오 선택)
├── content.css        # 호버 하이라이트 스타일
├── sniffer.js         # MAIN world 스크립트 (HLS/DASH URL 캡처)
├── sidepanel.html     # 사이드패널 UI
├── sidepanel.js       # 사이드패널 로직
├── sidepanel.css      # 사이드패널 스타일
├── offscreen.html     # 오프스크린 문서 (영상 다운로드)
├── offscreen.js       # OPFS 기반 영상 다운로드 로직
└── icons/             # 확장 아이콘
```

## 기술 스택

- Chrome Extension Manifest V3
- Side Panel API
- OPFS (Origin Private File System)
- Content Scripts (ISOLATED + MAIN world)
- `chrome.cookies`, `chrome.downloads`, `chrome.webRequest`
- C2PA JUMBF 바이너리 파싱
- XMP/IPTC 메타데이터 추출
