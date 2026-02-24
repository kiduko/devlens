# DevLens

웹 이미지/동영상 분석 · 다운로드 · API 모니터링 Chrome 확장 프로그램

---

## 이미지/동영상 분석

**Cmd(Ctrl)+클릭**으로 페이지 내 이미지 또는 `<video>`를 선택하면 사이드패널에서 상세 정보를 확인할 수 있습니다.

- EXIF / XMP / IPTC 메타데이터 (카메라, 렌즈, 촬영 설정, GPS 등)
- 파일 포맷, 크기, 해상도, 렌더 크기, HTTP 응답 헤더
- 이미지 오버레이 — 페이지 내 모든 이미지에 파일 크기/상태 뱃지 표시
- Base64 이미지 지원

### 접근 권한 분석

선택한 이미지의 접근 방식을 자동으로 분류합니다.

- **Signed URL 감지** — AWS S3, GCP, Azure SAS 등 서명 파라미터 자동 식별
- **쿠키 의존성** — `credentials: omit` fetch 테스트로 쿠키 필요 여부 판별
- **인증 쿠키 목록** — 해당 도메인의 인증 관련 쿠키 조회
- CORS 정책, 캐시 정책, CDN 식별 (CloudFront, Cloudflare, Fastly, Akamai 등)

### URL 파라미터 편집

CDN별 이미지 품질/크기 파라미터를 자동 감지하고 슬라이더로 조절할 수 있습니다.

- Cloudinary, Google, YouTube, Naver, WordPress, Shopify 등 주요 CDN 패턴 지원
- **최고 화질** 버튼 — CDN별 최적 파라미터 자동 설정
- 변경 전후 용량/해상도 비교 배너

### 다운로드

- 이미지/동영상 다운로드 — 자동 저장, 하위폴더 지정, GIF/동영상 자동 다운로드
- HLS(m3u8) 스트리밍 다운로드
- **OPFS 스트리밍** — 1GB 이상 대용량 영상도 메모리 부족 없이 다운로드
- cURL 명령어 생성, 이미지 클립보드 복사

---

## API Checker

Swagger/OpenAPI 스펙을 등록하면, 페이지에서 발생하는 네트워크 요청을 실시간으로 캡처하여 등록된 엔드포인트와 자동 매칭합니다.

### 스펙 관리

URL 입력 또는 파일 업로드로 스펙을 등록합니다. Swagger 2.0과 OpenAPI 3.x를 모두 지원하며 JSON/YAML 자동 감지합니다.

- `$ref` 내부 참조 자동 해석
- basePath 추론 — 스펙에 명시되지 않은 경우 소스 URL에서 자동 유추
- **스펙 그룹** — 여러 스펙을 그룹으로 묶어 관리, 그룹 단위로 활성화/전환
- 24시간 주기 자동 갱신, 수동 새로고침
- 그룹 설정 Import / Export

### 요청 캡처

Chrome Debugger Protocol(CDP)을 사용하여 XHR/Fetch 요청을 실시간으로 캡처합니다.

- 요청/응답 헤더, 본문, Set-Cookie, 상태 코드, 소요 시간 수집
- 최대 5,000건 링 버퍼 유지
- 응답 본문 1MB 초과 시 자동 절삭 (절삭 표시)

### 매칭

캡처된 요청의 경로를 등록된 스펙의 엔드포인트와 비교합니다.

1. **정확 매칭** — 경로가 정확히 일치 (`/users/me` → `/users/me`)
2. **패턴 매칭** — path parameter 추출 (`/users/123` → `/users/{id}`, `id=123`)

매칭 결과에 confidence (exact/pattern), operationId, tags, 추출된 path params가 표시됩니다.

### 뷰 모드

| 뷰 | 설명 |
|-----|------|
| **리스트** | method · path · status · duration · 매칭 여부 컬럼 |
| **타임라인** | 시간순 요청 흐름, 3초 이상 갭 시각적 표시 |
| **워터폴** | 요청별 타이밍 바 차트, 자동 스케일 시간축 |

### 필터링 & 상세 정보

텍스트 검색, HTTP 메서드(GET/POST/PUT/PATCH/DELETE), 상태 코드(2xx/3xx/4xx/5xx), 매칭 여부로 필터링할 수 있습니다.

요청을 선택하면 탭별 상세 정보를 확인할 수 있습니다:

| 탭 | 내용 |
|----|------|
| **Headers** | 요청/응답 헤더 |
| **Payload** | 요청 본문 (JSON 뷰어) |
| **Cookies** | Set-Cookie 파싱 결과 |
| **Response** | 응답 본문 (JSON 뷰어) |
| **Match** | 매칭된 엔드포인트, path params, confidence, tags |

---

## 갤러리

다운로드한 이미지/동영상 이력을 조회할 수 있습니다.

---

## 설치

### 릴리즈

[Releases](https://github.com/kiduko/devlens/releases)에서 zip을 받아 압축 해제하면 `devlens/` 폴더가 생깁니다.

1. `chrome://extensions` → 개발자 모드 → `devlens` 폴더 로드
2. 업데이트 시 같은 위치에 덮어쓴 뒤 확장 프로그램 리로드

### 소스 빌드

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

WXT · React · TypeScript · Tailwind CSS · Zustand · Vitest · Chrome MV3
