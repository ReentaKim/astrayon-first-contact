# 05 · 확인한 공식 문서

확인 기준일: 2026-10-15. 아래 자료는 작업 환경과 기술 구성에 대한 참고다. 게임의 줄거리, 대사, 수치와 쇼트 구성은 이 패키지의 창작 제안이다. 앱 UI·설치 버전에 따라 경로와 API가 달라질 수 있다.

1. **OpenAI Help — ChatGPT Work and Codex**
   https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex
   데스크톱 왼쪽 위 메뉴에서 Codex를 선택하며, Codex는 코드·테스트·명령·저장소와 로컬 폴더 작업을 위한 경험임을 확인.

2. **OpenAI — Projects and chats**
   https://developers.openai.com/codex/projects
   현재 `https://learn.chatgpt.com/docs/projects`로 연결됨. 로컬 프로젝트 폴더와 문맥, New chat에서 기존 ChatGPT 대화를 Codex 대화에 추가하는 안내를 확인. 모드 선택만으로 모든 첨부파일이 로컬 게임 자산으로 저장되었다고 가정하지 않음.

3. **OpenAI — Custom instructions with AGENTS.md**
   https://developers.openai.com/codex/agent-configuration/agents-md
   저장소 지침을 AGENTS.md에 보존하는 방식 확인.

4. **Next.js — Static exports / use client**
   https://nextjs.org/docs/app/guides/static-exports
   https://nextjs.org/docs/app/api-reference/directives/use-client
   정적 내보내기와 브라우저 전용 API의 실행 경계 참고.

5. **PixiJS — Introduction / Application / Assets**
   https://pixijs.com/8.x/guides/getting-started/intro
   https://pixijs.com/8.x/guides/components/application
   https://pixijs.com/8.x/guides/components/assets
   브라우저 2D 렌더러, 애플리케이션 초기화 및 자산 로딩 구조 참고. 이 패키지에서 설치·실행 검증한 것은 아님.

6. **GSAP — Timeline**
   https://gsap.com/docs/v3/GSAP/Timeline/
   타임라인의 순서·겹침·라벨·재생 제어 참고.

7. **MDN — Autoplay guide / Web Audio best practices**
   https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
   https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
   사용자 입력을 통한 오디오 시작/재개, 자동재생 제한 대응 참고.
