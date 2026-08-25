# 배포 순서

처음 해보는 사람 기준으로, 위에서부터 그대로 따라가면 됩니다.

---

## 0. 준비물

**Node.js** — https://nodejs.org 에서 LTS 설치. 터미널에서 확인:

```bash
node -v    # v20 이상이면 OK
```

**계정 2개** — github.com, vercel.com (Vercel 은 GitHub 계정으로 로그인)

---

## 1. 백엔드 개발자에게 받을 것

```
1) 백엔드 배포 주소   예: https://meetroute-api.example.com
2) (지도용) 카카오 JavaScript 키
```

주소를 아직 못 받았어도 2~3번은 진행할 수 있습니다.

---

## 2. 로컬에서 먼저 띄워보기

```bash
npm install                    # 1~2분, 한 번만
cp .env.example .env.local     # 그리고 아래 두 줄을 채웁니다
npm run dev                    # http://localhost:5173
```

`.env.local` 에 채울 것:

```
VITE_BACKEND_ORIGIN=<받은 백엔드 주소>
VITE_KAKAO_APP_KEY=<카카오 JavaScript 키>
```

브라우저에서 http://localhost:5173 을 열어 매장 목록이 뜨면 성공입니다.
종료는 터미널에서 `Ctrl + C`.

| 증상 | 원인 | 할 일 |
| --- | --- | --- |
| 목록이 비어 있음 | 백엔드가 안 떠 있음 | 백엔드 개발자에게 확인 |
| 지도가 격자로 나옴 | 카카오 키가 없거나 도메인 미등록 | 5번 참고 |
| `npm: command not found` | Node.js 미설치 | 0번으로 |

---

## 3. vercel.json 수정

`vercel.json` 을 열어 `REPLACE-WITH-BACKEND-HOST` 를 실제 주소로 바꿉니다.

```json
"destination": "https://meetroute-api.example.com/api/:path*"
```

- `/api/:path*` 부분은 **지우지 마세요**
- 주소 끝에 `/` 를 붙이지 마세요
- `http://` 또는 `https://` 를 **반드시** 포함하세요

---

## 4. GitHub 에 올리고 Vercel 에 배포

```bash
git init
git add .
git commit -m "MeetRoute 프론트엔드"
```

github.com → `+` → **New repository** → 이름 입력 → **Public** →
체크박스는 전부 해제(README 추가하지 않기) → **Create repository**.

다음 화면에 나오는 명령어를 그대로 붙여넣습니다:

```bash
git remote add origin https://github.com/<본인아이디>/<저장소이름>.git
git branch -M main
git push -u origin main
```

vercel.com → **Add New** → **Project** → 방금 만든 저장소 **Import** →
설정은 건드리지 말고(Vite 가 자동 감지됩니다) → **Deploy**.

배포 후 **Settings → Environment Variables** 에 키를 넣고 **재배포**합니다.
`VITE_` 값은 빌드 시점에 구워지므로, 추가만 하고 재배포하지 않으면 반영되지 않습니다.

```
VITE_KAKAO_APP_KEY = <카카오 JavaScript 키>
```

---

## 5. 카카오 도메인 등록 (지도를 쓴다면 필수)

developers.kakao.com → 내 애플리케이션 → **앱 설정 > 플랫폼 > Web 플랫폼 등록**

사이트 도메인에 **앱이 뜨는 주소를 전부** 넣습니다:

```
http://localhost:5173
https://<프로젝트>.vercel.app
```

이걸 빼먹으면 배포된 사이트에서만 지도가 격자로 나옵니다. 카카오 JavaScript 키는
번들에 그대로 들어가 누구나 볼 수 있고, 대신 **등록된 도메인에서만** 동작합니다.
즉 이 도메인 등록이 곧 접근 제어입니다. REST API 키는 절대 넣지 마세요.

---

## 체크리스트

```
□ Node.js 설치
□ GitHub · Vercel 계정
□ 백엔드 주소 받기            ← 백엔드 개발자
□ npm install
□ npm run dev 로 확인
□ vercel.json 주소 교체
□ GitHub 에 push
□ Vercel Import → Deploy
□ Vercel 환경변수 + 재배포
□ 카카오 플랫폼에 도메인 등록
```

---

## 배포 후 확인

- [ ] 로그인하고 새로고침해도 로그인이 유지되는가
- [ ] AI 브리핑이 `COMMON401` 없이 생성되는가
- [ ] 지도에 핀이 뜨고, 드래그하면 그 영역의 매장으로 바뀌는가

세 번째가 안 되면 카카오 도메인 등록(5번)을, 앞의 둘이 안 되면 `vercel.json` 의
주소(3번)를 다시 확인하세요.
