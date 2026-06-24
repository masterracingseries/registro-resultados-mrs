'use client';

import { CheckCircle2, AlertTriangle, Trash2, Plus, UserPlus, X } from 'lucide-react';
import { ResultRow, Pilot } from '@/types';
import { F1_TEAMS, cn } from '@/lib/constants';
import { calculatePoints } from '@/lib/points';

interface ResultsTableProps {
  results: ResultRow[];
  pilots: Pilot[];
  raceType: 'Carrera' | 'Sprint';
  onUpdate: (index: number, updates: Partial<ResultRow>) => void;
  onDelete: (index: number) => void;
}

export default function ResultsTable({
  results,
  pilots,
  raceType,
  onUpdate,
  onDelete,
}: ResultsTableProps) {
  const pilotLabel = (p: Pilot) => p.alias1 || p.idPilotoOficial;

  const uniquePilots = Array.from(
    new Map(pilots.map((p) => [p.idPilotoOficial, p])).values()
  ).sort((a, b) => pilotLabel(a).localeCompare(pilotLabel(b)));

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
    const pilotRows = pilots.filter((p) => p.idPilotoOficial === row.pilotId);
    const first = pilotRows[0];
    if (!first) return false;
    // Can save alias if alias2 or alias3 is empty
    return !first.alias2 || !first.alias3;
  };

  const aliasSlotLabel = (row: ResultRow): string => {
    if (!row.pilotId) return '';
    const pilotRows = pilots.filter((p) => p.idPilotoOficial === row.pilotId);
    const first = pilotRows[0];
    if (!first) return '';
    if (!first.alias2) return 'Alias 2';
    if (!first.alias3) return 'Alias 3';
    return 'Sin espacio';
  };

  const unmatched = results.filter((r) => !r.matched && !r.isNewPilot && !r.pilotId).length;

  return (
    <div className="space-y-4">
      {unmatched > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 px-4 py-2 text-xs text-amber-800 uppercase tracking-widest font-bold">
          <AlertTriangle size={14} />
          {unmatched} piloto{unmatched > 1 ? 's' : ''} sin match — resuelve antes de guardar
        </div>
      )}

      <div className="border border-[#141414] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#141414] text-[#E4E3E0]">
                <th className="px-3 py-3 text-[10px] uppercase tracking-widest w-10">Pos</th>
                <th className="px-3 py-3 text-[10px] uppercase tracking-widest">Piloto (juego)</th>
                <th className="px-3 py-3 text-[10px] uppercase tracking-widest w-6"></th>
                <th className="px-3 py-3 text-[10px] uppercase tracking-widest">Piloto Oficial</th>
                <th className="px-3 py-3 text-[10px] uppercase tracking-widest">Equipo</th>
                <th className="px-3 py-3 text-[10px] uppercase tracking-widest w-12">Pts</th>
                <th className="px-3 py-3 text-[10px] uppercase tracking-widest w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141414]/10">
              {results.map((row, idx) => (
                <tr
                  key={idx}
                  className={cn(
                    'group transition-colors',
                    row.matched ? 'hover:bg-[#141414]/5' : 'bg-amber-50/60 hover:bg-amber-50'
                  )}
                >
                  {/* Pos */}
                  <td className="px-3 py-3 font-mono text-sm font-bold">{row.position}</td>

                  {/* In-game name */}
                  <td className="px-3 py-3">
                    <span className="text-xs font-mono opacity-70">{row.pilotName}</span>
                  </td>

                  {/* Match status */}
                  <td className="px-3 py-3">
                    {row.matched ? (
                      <CheckCircle2 size={14} className="text-emerald-600" />
                    ) : (
                      <AlertTriangle size={14} className="text-amber-500" />
                    )}
                  </td>

                  {/* Official pilot / new pilot */}
                  <td className="px-3 py-3 min-w-[200px]">
                    {row.isNewPilot ? (
                      /* ── New pilot mini-form ── */
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                          <UserPlus size={11} />
                          <span className="truncate max-w-[130px]">{row.pilotName}</span>
                          <button
                            onClick={() => handleCancelNewPilot(idx)}
                            className="ml-auto opacity-50 hover:opacity-100"
                          >
                            <X size={11} />
                          </button>
                        </div>
                        <div className="flex gap-1">
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
                                'text-[9px] px-2 py-0.5 border uppercase tracking-wider',
                                row.newPilotTipo === tipo
                                  ? 'bg-[#141414] text-[#E4E3E0] border-[#141414]'
                                  : 'border-[#141414]/40 hover:border-[#141414]'
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
                              'w-full bg-transparent border px-1.5 py-1 text-[10px] focus:outline-none cursor-pointer',
                              !row.newPilotEquipo ? 'border-red-400 text-red-500' : 'border-[#141414]/40'
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
                            !row.pilotId && 'text-red-500 font-bold'
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
                          <div className="mt-1.5 space-y-1">
                            {canSaveAlias(row) && (
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`action-${idx}`}
                                  checked={row.saveAsAlias && !row.updateAlias1}
                                  onChange={() => onUpdate(idx, { saveAsAlias: true, updateAlias1: false })}
                                  className="accent-[#141414]"
                                />
                                <span className="text-[9px] uppercase tracking-wider text-amber-700">
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
                                className="accent-[#141414]"
                              />
                              <span className="text-[9px] uppercase tracking-wider text-blue-700">
                                Nuevo ID Oficial (reemplazar alias_1)
                              </span>
                            </label>
                            {!canSaveAlias(row) && !row.updateAlias1 && (
                              <span className="text-[9px] text-red-500 uppercase tracking-wider block">
                                3 aliases llenos
                              </span>
                            )}
                          </div>
                        )}

                        {/* New pilot button (only when no pilot selected and row is unmatched) */}
                        {!row.matched && !row.pilotId && (
                          <button
                            onClick={() => handleNewPilot(idx, row)}
                            className="mt-1.5 flex items-center gap-1 text-[9px] uppercase tracking-wider text-emerald-700 hover:text-emerald-900"
                          >
                            <UserPlus size={10} /> Registrar como nuevo piloto
                          </button>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Team dropdown */}
                  <td className="px-3 py-3 min-w-[160px]">
                    <select
                      value={row.team}
                      onChange={(e) => onUpdate(idx, { team: e.target.value })}
                      className="w-full bg-transparent text-xs italic opacity-70 focus:outline-none cursor-pointer focus:opacity-100"
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
                  <td className="px-3 py-3 font-mono text-sm font-bold">
                    {calculatePoints(row.position, raceType)}
                  </td>

                  {/* Delete */}
                  <td className="px-3 py-3">
                    <button
                      onClick={() => onDelete(idx)}
                      className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] uppercase tracking-widest opacity-40 text-center">
        {results.length} pilotos • Salida, paradas y tiempos se guardan en segundo plano
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
  const pilotLabelAdd = (p: Pilot) => p.alias1 || p.idPilotoOficial;

  const uniquePilots = Array.from(
    new Map(pilots.map((p) => [p.idPilotoOficial, p])).values()
  ).sort((a, b) => pilotLabelAdd(a).localeCompare(pilotLabelAdd(b)));

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const pos = parseInt(data.get('pos') as string);
    const pilotId = data.get('pilotId') as string;
    const team = data.get('team') as string;
    const pilot = uniquePilots.find((p) => p.idPilotoOficial === pilotId);

    onAdd({
      position: pos,
      pilotName: pilot?.alias1 || pilotId,
      team,
      grid: null,
      stops: null,
      bestLap: '',
      time: '',
      points: calculatePoints(pos, raceType),
      matched: true,
      pilotId,
      pilotOfficialName: pilotLabelAdd(pilot!),
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
      className="border border-dashed border-[#141414]/40 p-4 grid grid-cols-12 gap-3 items-end"
    >
      <div className="col-span-2">
        <label className="text-[9px] uppercase tracking-widest opacity-50 block mb-1">Pos</label>
        <input
          name="pos"
          type="number"
          min={1}
          max={30}
          required
          className="w-full bg-transparent border border-[#141414]/40 px-2 py-1.5 text-xs focus:outline-none"
        />
      </div>
      <div className="col-span-4">
        <label className="text-[9px] uppercase tracking-widest opacity-50 block mb-1">Piloto</label>
        <select
          name="pilotId"
          required
          className="w-full bg-transparent border border-[#141414]/40 px-2 py-1.5 text-xs focus:outline-none cursor-pointer"
        >
          <option value="">Seleccionar...</option>
          {uniquePilots.map((p) => (
            <option key={p.idPilotoOficial} value={p.idPilotoOficial}>
              {pilotLabelAdd(p)}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-4">
        <label className="text-[9px] uppercase tracking-widest opacity-50 block mb-1">Equipo</label>
        <select
          name="team"
          className="w-full bg-transparent border border-[#141414]/40 px-2 py-1.5 text-xs focus:outline-none cursor-pointer"
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
          className="w-full bg-[#141414] text-[#E4E3E0] py-1.5 text-[10px] uppercase tracking-widest font-bold flex items-center justify-center gap-1 hover:opacity-90"
        >
          <Plus size={12} /> Agregar
        </button>
      </div>
    </form>
  );
}
