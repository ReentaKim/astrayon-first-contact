import type { Attack } from '../state/battle';
export const DURATION = 20;
export const SHOTS = [
  { id: 'K01', start: 0, end: 1.2, name: '명령 확정' },
  { id: 'K02', start: 1.2, end: 3.2, name: '파일럿 컷인' },
  { id: 'K03', start: 3.2, end: 6, name: '무장 전개' },
  { id: 'K04', start: 6, end: 9, name: '공격 개시' },
  { id: 'K05', start: 9, end: 10.5, name: '라이벌 반응' },
  { id: 'K06', start: 10.5, end: 13.5, name: '교차' },
  { id: 'K07', start: 13.5, end: 15, name: '충돌' },
  { id: 'K08', start: 15, end: 18, name: '잔광' },
  { id: 'K09', start: 18, end: 20.001, name: '전투 결과' },
] as const;
export function shotAt(time: number) { return SHOTS.find(s => time >= s.start && time < s.end) ?? SHOTS[8]; }
export function captionAt(time: number, attack: Attack) {
  if (time >= 1.2 && time < 3.2) return { speaker: '주인공', line: attack === 'rifle' ? '저 배에는 아직 사람이 있어. 여기서 길을 열겠어.' : '설명할 생각이 없다면, 내가 길을 열겠어.' };
  if (time >= 3.2 && time < 6) return { speaker: '주인공', line: attack === 'rifle' ? '사선 확보. 이 거리를 유지한다.' : '부스터 전개. 한 번에 파고든다!' };
  if (time >= 9 && time < 10.5) return { speaker: '가면의 파일럿', line: '그래서… 보내줄 수 없는 거다.' };
  if (time >= 10.5 && time < 13.5) return { speaker: '가면의 파일럿', line: attack === 'rifle' ? '그 빛으로, 무엇을 지키겠다는 거지.' : '너의 각오, 보여 봐라.' };
  if (time >= 18) return { speaker: '주인공', line: attack === 'rifle' ? '명중. 다음 사격을 위한 조준을 확보했어.' : '돌파했다… 아직 움직일 수 있어.' };
  return null;
}
