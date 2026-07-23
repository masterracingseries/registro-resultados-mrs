import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const F1_TRACKS = [
  'Bahrain (Sakhir)',
  'Arabia Saudita (Jeddah)',
  'Australia (Melbourne)',
  'Japón (Suzuka)',
  'China (Shanghai)',
  'Miami (USA)',
  'Emilia Romagna (Imola)',
  'Mónaco (Monte Carlo)',
  'Canadá (Montreal)',
  'España (Barcelona)',
  'España (Madrid)',
  'Austria (Spielberg)',
  'Gran Bretaña (Silverstone)',
  'Hungría (Budapest)',
  'Bélgica (Spa-Francorchamps)',
  'Países Bajos (Zandvoort)',
  'Italia (Monza)',
  'Azerbaiyán (Bakú)',
  'Singapur (Marina Bay)',
  'USA (Austin)',
  'México (Ciudad de México)',
  'Brasil (São Paulo)',
  'Las Vegas (USA)',
  'Qatar (Lusail)',
  'Abu Dhabi (Yas Marina)',
];

export const DIVISIONS = ['División 1', 'División 2', 'División 3', 'División 4'];

export const F1_TEAMS = [
  'Alpine',
  'Aston Martin Aramco',
  'Atlassian Williams F1 Team',
  'Audi Revolut F1 Team',
  'Cadillac Formula 1® Team',
  'Haas',
  'McLaren',
  'Mercedes-AMG F1 Team',
  'Oracle Red Bull Racing',
  'Reserva',
  'Scuderia Ferrari HP',
  'Visa Cash App Racing Bulls',
];

// Normaliza variaciones de OCR (ej: "Visa Cash App RB" o "Cadillac Formula 1 Team")
// al nombre oficial exacto, por coincidencia de tokens.
function normalizeTeamToken(s: string): string {
  return s
    .toLowerCase()
    .replace(/[®™©.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeTeamName(raw: string): string {
  if (!raw) return raw;
  const clean = raw.trim();

  const exact = F1_TEAMS.find((t) => t.toLowerCase() === clean.toLowerCase());
  if (exact) return exact;

  const cleanNorm = normalizeTeamToken(clean);
  const exactNorm = F1_TEAMS.find((t) => normalizeTeamToken(t) === cleanNorm);
  if (exactNorm) return exactNorm;

  const cleanTokens = new Set(cleanNorm.split(' '));
  let bestMatch = clean;
  let bestScore = 0;
  for (const team of F1_TEAMS) {
    const teamTokens = new Set(normalizeTeamToken(team).split(' '));
    const overlap = [...cleanTokens].filter((t) => teamTokens.has(t)).length;
    const score = overlap / Math.max(cleanTokens.size, teamTokens.size);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = team;
    }
  }
  return bestScore >= 0.4 ? bestMatch : clean;
}
