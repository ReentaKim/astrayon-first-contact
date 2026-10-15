# Project instructions — ASTRAYON scene

## Read first
Read `docs/01-CREATIVE-BRIEF.md`, `docs/02-SCENE-AND-SHOTLIST.md`, `docs/03-ART-AND-ASSETS.md`, and `docs/04-IMPLEMENTATION-AND-QA.md` before implementation. Inspect the reference images, especially 02 and the large PILOT portrait in 04. Reply to the user in Korean and address them as 린타 when natural.

## Objective
Build a browser-playable, cinematic anime mecha duel: one scene, two machines, two pilots. Prioritize shot direction, readable character identity, gameplay-to-cutscene transitions, original action poses, and audio synchronization over system breadth. This is not a landing page, marketing website, slideshow, or full tactical RPG.

## Scope
- Target a roughly 3-minute scene, with two consequential command decisions and a final attack command. Start by implementing the strongest approximately 20-second attack sequence end to end.
- Suggested stack: Next.js + TypeScript for the app, PixiJS for 2D rendering, GSAP for the timeline, Web Audio for sound. Use compatible stable versions discovered at setup and commit a lockfile. Do not blindly assume old APIs.
- The handoff folder contains documentation and reference assets, not an app. Create the app inside `web/` unless an existing project structure requires a different path. Never overwrite unrelated files to scaffold it.
- No account system, backend, database, multiplayer, shop, inventory, leveling, campaign map, or mandatory grid movement in the first slice. Preserve the tactical feel through commands, HP/EN, and pilot cut-ins.
- Existing images are references, not final transparent sprites or finished animation footage. Reference-based temporary crops may unblock an animatic, but they do not pass final art acceptance.
- Keep the rival visibly distinct: lighter brown hair and the asymmetric half-face mask shown in the main 04 portrait. Do not horizontally flip the entire pilot in a way that moves the mask to the other anatomical side.
- Do not treat embedded poster dates, credits, logos, machine specifications, or Japanese copy as approved game content.

## Implementation discipline
Keep battle state separate from rendering. Apply gameplay effects once per committed action, never on both a timeline callback and a skip handler. Use one managed timeline/audio scheduling policy. Cancel old callbacks on restart and dispose renderer, listeners, and audio resources on unmount. Provide explicit input locking during action resolution.

Honor sound settings, captions, reduced motion, pause, keyboard input, asset-load failure handling, and a replay action. Do not use excessive flashes or uncontrolled screen shake. Never put API secrets into the browser bundle. Do not enable paid external services, public deployment, or account connections without the user's authorization.

## Working method
First inspect what exists. Then build the small playable attack slice; do not stop at an implementation proposal. Missing final art must not block the interaction scaffold, but label it as temporary and write a concrete replacement list. Do not claim final anime footage or voice acting exists unless actual files have been created and checked.

## Validation and reporting
Before claiming completion, run the available type checks, build, state tests, and browser checks. If a tool or environment blocks a test, report that limitation explicitly. Report changed files, run commands, implemented behavior, remaining temporary assets, and actual test results. Never describe an untested visual target as verified.
