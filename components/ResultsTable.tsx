'use client';

import { CheckCircle2, AlertTriangle, Trash2, Plus, UserPlus, X, Timer } from 'lucide-react';
import { ResultRow, Pilot } from '@/types';
import { F1_TEAMS, cn } from '@/lib/constants';
import { calculatePoints } from '@/lib/points';
import { pilotLabel } from '@/lib/matching';

interface ResultsTableProps {
  results: ResultRow[];
  pilots: Pilot[];
  raceType: 'Carrera' | 'Sprint';
  onUpdate: (index: number, updates: Partial<ResultRow>) => void;
  onDelete: (index: number) => void;
}

function uniquePilotList(pilots: Pilot[]): Pilot[] {
  return Array.from(new Map(pilots.map((p) => [p.idPilotoOficial, p])).values()).sort((a, b) =>
    pilotLabel(a).localeCompare(pilotLabel(b))
  );
}

export default function ResultsTable({
  results,
  pilots,
  raceType,
  onUpdate,
  onDelete,
}: ResultsTableProps) {
  const uniquePilots = uniquePilotList(pilots);

  const handlePilotSelect = (index: number, pilotId: string) => {
    const pilot = uniquePilots.find((p) => p.idPilotoOficial === pilotId);
    onUpdate(index, {
      pilotId: pilotId || null,
      pilotOfficialName: pilot ? pilotLabel(pilot) : '',
      saveAsAlias: false,
      updateAlias1: false,
      isNewPilot: false,
    });
  };

  const handleNewPilot = (index: number, row: ResultRow) => {
    onUpdate(index, {
      isNewPilot: true,
      pilotId: row.pilotName.toUpperCase().substring(0, 16).trim(),
      newPilotTipo: 'Titular',
      newPilotEquipo: '',
      saveAsAlias: false,
      updateAlias1: false,
    });
  };

  const handleCancelNewPilot = (index: number) => {
    onUpdate(index, { isNewPilot: false, pilotId: null, newPilotEquipo: '' });
  };

  const canSaveAlias = (row: ResultRow): boolean => {
    if (!row.pilotId) return false;
    const first = pilots.find((p) => p.idPilotoOficial === row.pilotId);
    if (!first) return false;
    return !first.alias2 || !first.alias3;
  };

  const aliasSlotLabel = (row: ResultRow): string => {
    if (!row.pilotId) return '';
    const first = pilots.find((p) => p.idPilotoOficial === row.pilotId);
    if (!first) return '';
    if (!first.alias2) return 'Alias 2';
    if (!first.alias3) return 'Alias 3';
    return 'Sin espacio';
  };

  const matched = results.filter((r) => r.matched || r.pilotId).length;
  const pending = results.length - matched;

  return (
    <div className="space-y-4">
      {/* Resumen de matching */}
      <div className="flex items-center gap-4 text-sm font-semibold">
        <span className="flex items-center gap-1.5 text-emerald-700">
          <CheckCircle2 size={15} /> {matched} resuelto{matched !== 1 ? 's' : ''}
        </span>
        {pending > 0 && (
          <span className="flex items-center gap-1.5 text-accent">
            <AlertTriangle size={15} /> {pending} por resolver
          </span>
        )}
      </div>

      <div className="border border-ink overflow-hidden bg-paper-raised">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-ink text-paper">
                <th className="px-3 py-3 text-[11px] uppercase tracking-widest w-12">Pos</th>
                <th className="px-3 py-3 text-[11px] uppercase tracking-widest">Piloto (juego)</th>
                <th className="px-3 py-3 text-[11px] uppercase tracking-widest w-7"></th>
                <th className="px-3 py-3 text-[11px] uppercase tracking-widest">Piloto oficial</th>
                <th className="px-3 py-3 text-[11px] uppercase tracking-widest">Equipo</th>
                <th className="px-3 py-3 text-[11px] uppercase tracking-widest w-14 text-right">Pts</th>
                <th className="px-3 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {results.map((row, idx) => (
                <tr
                  key={idx}
                  className={cn(
                    'group transition-colors',
                    row.matched || row.pilotId ? 'hover:bg-ink/5' : 'bg-accent/5 hover:bg-accent/10'
                  )}
                >
                  {/* Pos */}
                  <td className="px-3 py-3 font-mono text-base font-bold align-top">{row.position}</td>

                  {/* In-game name + lap data */}
                  <td className="px-3 py-3 align-top">
                    <span className="text-sm font-mono font-semibold">{row.pilotName}</span>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] font-mono opacity-50">
                      {row.grid != null && <span title="Posición de salida">P{row.grid} salida</span>}
                      {row.bestLap && (
                        <span className="flex items-center gap-0.5" title="Mejor vuelta">
                          <Timer size={10} /> {row.bestLap}
                        </span>
                      )}
                      {row.time && <span title="Tiempo / diferencia">{row.time}</span>}
                    </div>
                  </td>

                  {/* Match status */}
                  <td className="px-3 py-3.5 align-top">
                    {row.matched || row.pilotId ? (
                      <CheckCircle2 size={15} className="text-emerald-600" />
                    ) : (
                      <AlertTriangle size={15} className="text-accent" />
                    )}
                  </td>

                  {/* Official pilot / new pilot */}
                  <td className="px-3 py-3 min-w-[210px] align-top">
                    {row.isNewPilot ? (
                      /* ── New pilot mini-form ── */
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                          <UserPlus size={12} />
                          <span className="truncate max-w-[140px]">{row.crossDivAlias1 || row.pilotName}</span>
                          <button
                            onClick={() => handleCancelNewPilot(idx)}
                            className="ml-auto opacity-50 hover:opacity-100"
                            title="Cancelar registro"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <div className="flex gap-1.5">
                          {(['Titular', 'Reserva'] as const).map((tipo) => (
                            <button
                              key={tipo}
                              onClick={() =>
                                onUpdate(idx, {
                                  newPilotTipo: tipo,
                                  newPilotEquipo: tipo === 'Reserva' ? 'Reserva' : '',
                                })
                              }
                              className={cn(
                                'text-[10px] px-2.5 py-1 border uppercase tracking-wider font-bold transition-colors',
                                row.newPilotTipo === tipo
                                  ? 'bg-ink text-paper border-ink'
                                  : 'border-ink/40 hover:border-ink'
                              )}
                            >
                              {tipo}
                            </button>
                          ))}
                        </div>
                        {row.newPilotTipo === 'Titular' && (
                          <select
                            value={row.newPilotEquipo}
                            onChange={(e) => onUpdate(idx, { newPilotEquipo: e.target.value })}
                            className={cn(
                              'w-full bg-transparent border px-2 py-1.5 text-xs focus:outline-none cursor-pointer transition-colors',
                              !row.newPilotEquipo ? 'border-accent text-accent' : 'border-ink/40'
                            )}
                          >
                            <option value="">— Equipo —</option>
                            {F1_TEAMS.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    ) : (
                      /* ── Existing pilot dropdown ── */
                      <div>
                        <select
                          value={row.pilotId || ''}
                          onChange={(e) => handlePilotSelect(idx, e.target.value)}
                          className={cn(
                            'w-full bg-transparent text-sm focus:outline-none cursor-pointer',
                            !row.pilotId && 'text-accent font-bold'
                          )}
                        >
                          <option value="">— Seleccionar —</option>
                          {uniquePilots.map((p) => (
                            <option key={p.idPilotoOficial} value={p.idPilotoOficial}>
                              {pilotLabel(p)}
                            </option>
                          ))}
                        </select>

                        {/* Options for unmatched rows with pilot selected */}
                        {!row.matched && row.pilotId && (
                          <div className="mt-2 space-y-1.5">
                            {canSaveAlias(row) && (
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`action-${idx}`}
                                  checked={row.saveAsAlias && !row.updateAlias1}
                                  onChange={() => onUpdate(idx, { saveAsAlias: true, updateAlias1: false })}
                                  className="accent-ink"
                                />
                                <span className="text-[11px] uppercase tracking-wider text-amber-700 font-semibold">
                                  Guardar como {aliasSlotLabel(row)}
                                </span>
                              </label>
                            )}
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`action-${idx}`}
                                checked={row.updateAlias1}
                                onChange={() => onUpdate(idx, { updateAlias1: true, saveAsAlias: false })}
                                className="accent-ink"
                              />
                              <span className="text-[11px] uppercase tracking-wider text-blue-800 font-semibold">
                                Nuevo ID oficial
                              </span>
                            </label>
                            {!canSaveAlias(row) && !row.updateAlias1 && (
                              <span className="text-[11px] text-accent uppercase tracking-wider block font-semibold">
                                3 aliases llenos
                              </span>
                            )}
                          </div>
                        )}

                        {/* New pilot button (only when no pilot selected and row is unmatched) */}
                        {!row.matched && !row.pilotId && (
                          <button
                            onClick={() => handleNewPilot(idx, row)}
                            className="mt-2 flex items-center gap-1 text-[11px] uppercase tracking-wider text-emerald-700 hover:text-emerald-900 font-semibold"
                          >
                            <UserPlus size={11} /> Registrar como nuevo piloto
                          </button>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Team dropdown */}
                  <td className="px-3 py-3 min-w-[170px] align-top">
                    <select
                      value={row.team}
                      onChange={(e) => onUpdate(idx, { team: e.target.value })}
                      className="w-full bg-transparent text-sm opacity-75 focus:outline-none cursor-pointer focus:opacity-100"
                    >
                      {F1_TEAMS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                      {!F1_TEAMS.includes(row.team) && row.team && (
                        <option value={row.team}>{row.team} (detectado)</option>
                      )}
                    </select>
                  </td>

                  {/* Points */}
                  <td className="px-3 py-3 font-mono text-base font-bold text-right align-top">
                    {calculatePoints(row.position, raceType)}
                  </td>

                  {/* Delete */}
                  <td className="px-3 py-3 align-top">
                    <button
                      onClick={() => onDelete(idx)}
                      title="Eliminar fila"
                      className="text-accent/60 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:text-accent"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] uppercase tracking-widest opacity-40 text-center">
        {results.length} pilotos · salida, paradas y tiempos se guardan automáticamente
      </p>
    </div>
  );
}

// Mini form to add a pilot manually
export function AddPilotForm({
  pilots,
  raceType,
  onAdd,
}: {
  pilots: Pilot[];
  raceType: 'Carrera' | 'Sprint';
  onAdd: (row: ResultRow) => void;
}) {
  const uniquePilots = uniquePilotList(pilots);

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const pos = parseInt(data.get('pos') as string);
    const pilotId = data.get('pilotId') as string;
    const team = data.get('team') as string;
    const pilot = uniquePilots.find((p) => p.idPilotoOficial === pilotId);
    if (!pilot) return;

    onAdd({
      position: pos,
      pilotName: pilot.alias1 || pilotId,
      team,
      grid: null,
      stops: null,
      bestLap: '',
      time: '',
      points: calculatePoints(pos, raceType),
      matched: true,
      pilotId,
      pilotOfficialName: pilotLabel(pilot),
      saveAsAlias: false,
      updateAlias1: false,
      isNewPilot: false,
      newPilotTipo: 'Titular',
      newPilotEquipo: '',
    });
    form.reset();
  };

  return (
    <form
      onSubmit={handleAdd}
      className="border border-dashed border-ink/40 bg-paper-raised p-4 grid grid-cols-12 gap-3 items-end"
    >
      <div className="col-span-2">
        <label className="text-[11px] uppercase tracking-widest opacity-60 font-semibold block mb-1">Pos</label>
        <input
          name="pos"
          type="number"
          min={1}
          max={30}
          required
          className="w-full bg-transparent border border-ink/40 px-2 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
        />
      </div>
      <div className="col-span-4">
        <label className="text-[11px] uppercase tracking-widest opacity-60 font-semibold block mb-1">Piloto</label>
        <select
          name="pilotId"
          required
          className="w-full bg-transparent border border-ink/40 px-2 py-2 text-sm focus:outline-none focus:border-accent transition-colors cursor-pointer"
        >
          <option value="">Seleccionar…</option>
          {uniquePilots.map((p) => (
            <option key={p.idPilotoOficial} value={p.idPilotoOficial}>
              {pilotLabel(p)}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-4">
        <label className="text-[11px] uppercase tracking-widest opacity-60 font-semibold block mb-1">Equipo</label>
        <select
          name="team"
          className="w-full bg-transparent border border-ink/40 px-2 py-2 text-sm focus:outline-none focus:border-accent transition-colors cursor-pointer"
        >
          {F1_TEAMS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-2">
        <button
          type="submit"
          className="w-full bg-ink text-paper py-2 text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-1 hover:bg-accent transition-colors"
        >
          <Plus size={13} /> Agregar
        </button>
      </div>
    </form>
  );
}
