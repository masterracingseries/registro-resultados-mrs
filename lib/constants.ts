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
  'Aston Martin',
  'Atlassian Williams F1 Team',
  'Audi Revolut F1 Team',
  'Cadillac Formula 1® Team',
  'Haas',
  'McLaren',
  'Mercedes-AMG F1 Team',
  'Oracle Red Bull Racing',
  'Scuderia Ferrari HP',
  'Visa Cash App RB',
];
