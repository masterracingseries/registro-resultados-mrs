const RACE_POINTS: Record<number, number> = {
  1: 30, 2: 25, 3: 23, 4: 21, 5: 18,
  6: 15, 7: 12, 8: 10, 9: 8, 10: 6,
  11: 5, 12: 4, 13: 2, 14: 1,
};

const SPRINT_POINTS: Record<number, number> = {
  1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1,
};

export function calculatePoints(position: number, type: 'Carrera' | 'Sprint'): number {
  const table = type === 'Sprint' ? SPRINT_POINTS : RACE_POINTS;
  return table[position] ?? 0;
}
