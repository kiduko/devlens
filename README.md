# DevLens

웹 이미지/동영상 분석 · 다운로드 · API 모니터링 Chrome 확장 프로그램

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

Swagger/OpenAPI 스펙을 등록하면 페이지의 네트워크 요청을 실시간으로 캡처하고, 등록된 API 엔드포인트와 자동 매칭합니다.

#### 스펙 관리
- **URL 또는 파일 업로드**로 스펙 등록 (Swagger 2.0 / OpenAPI 3.x, JSON/YAML)
- `$ref` 자동 해석, basePath 추론
- 스펙 그룹으로 분류 — 그룹 단위 활성화/전환
- 스펙 자동 갱신 (24시간), 수동 새로고침
- 그룹 설정 Import / Export

#### 요청 캡처
- Chrome Debugger Protocol로 XHR/Fetch 요청 실시간 캡처
- 요청/응답 헤더, 본문, Set-Cookie, 상태 코드, 소요 시간 수집
- 최대 5,000건 링 버퍼, 응답 본문 1MB 초과 시 자동 절삭

#### 매칭
- 정확 매칭 (exact path) → 패턴 매칭 (`/users/{id}` 등 path param 추출)
- basePath 자동 제거 후 비교
- 매칭 결과에 confidence (exact / pattern), operationId, tags 표시

#### 뷰 모드
- **리스트** — method·path·status·duration·매칭 여부 컬럼
- **타임라인** — 시간순 요청 흐름, 3초 이상 갭 표시
- **워터폴** — 요청 타이밍 바 차트, 자동 스케일 시간축

#### 필터링
- 텍스트 검색 (URL, path, method, status)
- HTTP 메서드별 (GET/POST/PUT/PATCH/DELETE)
- 상태 코드 범위 (2xx/3xx/4xx/5xx)
- 매칭 여부 (전체/매칭/미매칭)

#### 상세 정보
- **Headers** — 요청/응답 헤더
- **Payload** — 요청 본문 (JSON 뷰어)
- **Cookies** — Set-Cookie 파싱
- **Response** — 응답 본문 (JSON 뷰어, 절삭 표시)
- **Match** — 매칭된 엔드포인트, path params, confidence, tags

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
