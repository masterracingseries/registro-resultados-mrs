export interface Pilot {
  rowIndex: number;
  idPilotoDivision: string;
  idPilotoOficial: string;
  nombreOficial: string;
  equipoActual: string;
  divisionActual: string;
  statusGeneral: string; // Titular / Reserva / Pendiente (col F)
  alias1: string;
  alias2: string;
  alias3: string;
}

export interface ResultRow {
  position: number;
  pilotName: string;
  team: string;
  grid: number | null;
  stops: number | null;
  bestLap: string;
  time: string;
  points: number;
  matched: boolean;
  pilotId: string | null;
  pilotOfficialName: string;
  // alias options (for unmatched rows where pilot was manually selected)
  saveAsAlias: boolean;
  updateAlias1: boolean;
  // new pilot registration
  isNewPilot: boolean;
  newPilotTipo: 'Titular' | 'Reserva';
  newPilotEquipo: string;
  crossDivAlias1?: string; // official alias1 when matched cross-division (used for new Maestro_Pilotos row)
}

export interface NewPilot {
  alias1: string;
  division: string;
  tipo: 'Titular' | 'Reserva';
  equipo: string;
}

export interface Alias1Update {
  rowIndices: number[];
  newAlias1: string;
  oldAlias1: string;
  oldAlias1Column: 'I' | 'J' | null;
}

export interface RaceMetadata {
  granPremio: string;
  division: string;
  fecha: string;
  tipoCarrera: 'Carrera' | 'Sprint';
}

export interface AliasUpdate {
  rowIndices: number[];
  column: 'I' | 'J';
  value: string;
}
