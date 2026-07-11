import { Pilot, ResultRow, AliasUpdate, Alias1Update, NewPilot } from '@/types';
import { normalizeTeamName } from '@/lib/constants';
import { calculatePoints } from '@/lib/points';

export type Extracted = {
  pos: number;
  piloto: string;
  equipo: string;
  salida: number;
  paradas: number;
  mejor_tiempo: string;
  tiempo: string;
};

// Nombre visible de un piloto: siempre alias_1 (= ID_Piloto_Oficial). Nombre_Oficial está vacío.
export const pilotLabel = (p: Pilot) => p.alias1 || p.idPilotoOficial;

// "JSQ_Kadmoz" → "JSQ_KADMOZ", "KADMOZ_JSQ" → "JSQ_KADMOZ" (mismo resultado → match)
export function tokenSort(name: string): string {
  return name.toUpperCase().trim().split(/[_\s]+/).sort().join('_');
}

function buildAliasMap(pilots: Pilot[]): Map<string, Pilot> {
  const map = new Map<string, Pilot>();
  pilots.forEach((p) => {
    if (p.alias1) map.set(p.alias1.toUpperCase().trim(), p);
    if (p.alias2) map.set(p.alias2.toUpperCase().trim(), p);
    if (p.alias3) map.set(p.alias3.toUpperCase().trim(), p);
  });
  return map;
}

function buildTokenMap(pilots: Pilot[]): Map<string, Pilot> {
  const map = new Map<string, Pilot>();
  pilots.forEach((p) => {
    if (p.alias1) map.set(tokenSort(p.alias1), p);
    if (p.alias2) map.set(tokenSort(p.alias2), p);
    if (p.alias3) map.set(tokenSort(p.alias3), p);
  });
  return map;
}

const emptyRowFlags = {
  saveAsAlias: false,
  updateAlias1: false,
  isNewPilot: false,
  newPilotTipo: 'Titular' as const,
  newPilotEquipo: '',
};

export function matchResults(
  extracted: Extracted[],
  pilots: Pilot[],
  raceType: 'Carrera' | 'Sprint',
  division: string
): ResultRow[] {
  // Same-division pilots only
  const divPilots = pilots.filter((p) => p.divisionActual === division);
  const exactMap = buildAliasMap(divPilots);
  const tokenMap = buildTokenMap(divPilots);

  // All pilots (any division) for cross-division fallback
  const anyExactMap = buildAliasMap(pilots);
  const anyTokenMap = buildTokenMap(pilots);

  return extracted.map((r) => {
    const key = r.piloto.toUpperCase().trim();
    const tkey = tokenSort(r.piloto);
    const normalizedTeam = normalizeTeamName(r.equipo);
    const base = {
      position: r.pos,
      pilotName: r.piloto,
      grid: r.salida ?? null,
      stops: r.paradas ?? null,
      bestLap: r.mejor_tiempo || '',
      time: r.tiempo || '',
      points: calculatePoints(r.pos, raceType),
    };

    // 1. Exact division match
    const sameDiv = exactMap.get(key) ?? tokenMap.get(tkey);
    if (sameDiv) {
      return {
        ...base,
        ...emptyRowFlags,
        // Reservas registradas en esta división también deben mostrar "Reserva" en equipo
        team: sameDiv.statusGeneral === 'Reserva' ? 'Reserva' : normalizedTeam,
        matched: true,
        pilotId: sameDiv.idPilotoOficial,
        pilotOfficialName: pilotLabel(sameDiv),
      };
    }

    // 2. Cross-division match → probable reserva en esta división
    const crossDiv = anyExactMap.get(key) ?? anyTokenMap.get(tkey);
    if (crossDiv) {
      return {
        ...base,
        ...emptyRowFlags,
        team: 'Reserva',
        matched: false,
        pilotId: crossDiv.idPilotoOficial,
        pilotOfficialName: pilotLabel(crossDiv),
        isNewPilot: true,
        newPilotTipo: 'Reserva' as const,
        newPilotEquipo: 'Reserva',
        crossDivAlias1: crossDiv.alias1,
      };
    }

    // 3. Sin match
    return {
      ...base,
      ...emptyRowFlags,
      team: normalizedTeam,
      matched: false,
      pilotId: null,
      pilotOfficialName: '',
    };
  });
}

export function collectAliasUpdates(results: ResultRow[], pilots: Pilot[]): AliasUpdate[] {
  const updates: AliasUpdate[] = [];
  results.forEach((r) => {
    if (!r.saveAsAlias || !r.pilotId || r.matched) return;
    const pilotRows = pilots.filter((p) => p.idPilotoOficial === r.pilotId);
    if (!pilotRows.length) return;
    const first = pilotRows[0];
    const column: 'I' | 'J' | null = !first.alias2 ? 'I' : !first.alias3 ? 'J' : null;
    if (!column) return;
    updates.push({ rowIndices: pilotRows.map((p) => p.rowIndex), column, value: r.pilotName });
  });
  return updates;
}

export function collectAlias1Updates(results: ResultRow[], pilots: Pilot[]): Alias1Update[] {
  const updates: Alias1Update[] = [];
  results.forEach((r) => {
    if (!r.updateAlias1 || !r.pilotId || r.matched) return;
    const pilotRows = pilots.filter((p) => p.idPilotoOficial === r.pilotId);
    if (!pilotRows.length) return;
    const first = pilotRows[0];
    const oldAlias1Column: 'I' | 'J' | null = !first.alias2 ? 'I' : !first.alias3 ? 'J' : null;
    updates.push({
      rowIndices: pilotRows.map((p) => p.rowIndex),
      newAlias1: r.pilotName,
      oldAlias1: first.alias1,
      oldAlias1Column,
    });
  });
  return updates;
}

export function collectNewPilots(results: ResultRow[], division: string): NewPilot[] {
  return results
    .filter((r) => r.isNewPilot && r.pilotId)
    .map((r) => ({
      // cross-div reservas usan su alias oficial; pilotos nuevos usan el nombre del juego
      alias1: r.crossDivAlias1 || r.pilotName,
      division,
      tipo: r.newPilotTipo,
      equipo: r.newPilotTipo === 'Reserva' ? 'Reserva' : r.newPilotEquipo,
    }));
}
