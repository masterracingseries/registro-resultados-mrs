'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Save,
  RotateCcw,
  ExternalLink,
  Calendar,
  MapPin,
  Users,
  Flag,
} from 'lucide-react';
import LoginForm from '@/components/LoginForm';
import ResultsTable, { AddPilotForm } from '@/components/ResultsTable';
import { Pilot, ResultRow, RaceMetadata, AliasUpdate, Alias1Update, NewPilot } from '@/types';
import { F1_TRACKS, DIVISIONS, cn, normalizeTeamName } from '@/lib/constants';
import { calculatePoints } from '@/lib/points';

const SPREADSHEET_ID = '11D8zcyPx3AdgPsF_pefks0hmicP3jGm22lDIZF24qAk';

type AppStatus = { type: 'success' | 'error'; message: string } | null;

// "JSQ_Kadmoz" → "JSQ_KADMOZ", "KADMOZ_JSQ" → "JSQ_KADMOZ" (mismo resultado → match)
function tokenSort(name: string): string {
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

type Extracted = {
  pos: number;
  piloto: string;
  equipo: string;
  salida: number;
  paradas: number;
  mejor_tiempo: string;
  tiempo: string;
};

function matchResults(extracted: Extracted[], pilots: Pilot[], raceType: 'Carrera' | 'Sprint', division: string): ResultRow[] {
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

    // 1. Exact division match
    const sameDiv = exactMap.get(key) ?? tokenMap.get(tkey);
    if (sameDiv) {
      return {
        position: r.pos,
        pilotName: r.piloto,
        // Reservas registradas en esta división también deben mostrar "Reserva" en equipo
        team: sameDiv.statusGeneral === 'Reserva' ? 'Reserva' : normalizedTeam,
        grid: r.salida ?? null,
        stops: r.paradas ?? null,
        bestLap: r.mejor_tiempo || '',
        time: r.tiempo || '',
        points: calculatePoints(r.pos, raceType),
        matched: true,
        pilotId: sameDiv.idPilotoOficial,
        pilotOfficialName: sameDiv.alias1 || sameDiv.idPilotoOficial,
        saveAsAlias: false,
        updateAlias1: false,
        isNewPilot: false,
        newPilotTipo: 'Titular',
        newPilotEquipo: '',
      };
    }

    // 2. Cross-division match → probable reserva en esta división
    const crossDiv = anyExactMap.get(key) ?? anyTokenMap.get(tkey);
    if (crossDiv) {
      return {
        position: r.pos,
        pilotName: r.piloto,
        team: 'Reserva',
        grid: r.salida ?? null,
        stops: r.paradas ?? null,
        bestLap: r.mejor_tiempo || '',
        time: r.tiempo || '',
        points: calculatePoints(r.pos, raceType),
        matched: false,
        pilotId: crossDiv.idPilotoOficial,
        pilotOfficialName: crossDiv.alias1 || crossDiv.idPilotoOficial,
        saveAsAlias: false,
        updateAlias1: false,
        isNewPilot: true,
        newPilotTipo: 'Reserva',
        newPilotEquipo: 'Reserva',
        crossDivAlias1: crossDiv.alias1,
      };
    }

    // 3. Sin match
    return {
      position: r.pos,
      pilotName: r.piloto,
      team: normalizedTeam,
      grid: r.salida ?? null,
      stops: r.paradas ?? null,
      bestLap: r.mejor_tiempo || '',
      time: r.tiempo || '',
      points: calculatePoints(r.pos, raceType),
      matched: false,
      pilotId: null,
      pilotOfficialName: '',
      saveAsAlias: false,
      updateAlias1: false,
      isNewPilot: false,
      newPilotTipo: 'Titular',
      newPilotEquipo: '',
    };
  });
}

function collectAlias1Updates(results: ResultRow[], pilots: Pilot[]): Alias1Update[] {
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

function collectNewPilots(results: ResultRow[], division: string): NewPilot[] {
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

function collectAliasUpdates(results: ResultRow[], pilots: Pilot[]): AliasUpdate[] {
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

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [image, setImage] = useState<string | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [metadata, setMetadata] = useState<RaceMetadata>({
    granPremio: F1_TRACKS[0],
    division: DIVISIONS[0],
    fecha: new Date().toISOString().split('T')[0],
    tipoCarrera: 'Carrera',
  });
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<AppStatus>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/auth')
      .then((r) => r.json())
      .then(({ ok }) => {
        setIsLoggedIn(ok);
        if (ok) loadPilots();
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (results.length > 0) {
      setResults((prev) =>
        prev.map((r) => ({ ...r, points: calculatePoints(r.position, metadata.tipoCarrera) }))
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadata.tipoCarrera]);

  const loadPilots = async () => {
    const res = await fetch('/api/pilots');
    if (res.ok) {
      const data = await res.json();
      setPilots(data.pilots);
    }
  };

  const handleLogin = () => { setIsLoggedIn(true); loadPilots(); };
  const handleLogout = async () => {
    await fetch('/api/login', { method: 'DELETE' });
    setIsLoggedIn(false);
    setPilots([]);
    setResults([]);
    setImage(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => { setImage(reader.result as string); setResults([]); setStatus(null); };
    reader.readAsDataURL(file);
  };

  const handleExtract = async () => {
    if (!image) return;
    setIsExtracting(true);
    setStatus(null);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      });
      if (!res.ok) {
        let msg = 'Error al extraer';
        try { msg = (await res.json()).error || msg; } catch {}
        throw new Error(msg);
      }
      const { results: extracted } = await res.json();
      setResults(matchResults(extracted, pilots, metadata.tipoCarrera, metadata.division));
      setStatus({ type: 'success', message: `${extracted.length} pilotos extraídos.` });
    } catch (err: unknown) {
      setStatus({ type: 'error', message: (err as Error).message || 'Error al extraer.' });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    const unresolved = results.filter((r) => !r.pilotId);
    if (unresolved.length > 0) {
      setStatus({ type: 'error', message: `${unresolved.length} piloto(s) sin asignar.` });
      return;
    }
    const invalidNewPilots = results.filter(
      (r) => r.isNewPilot && r.newPilotTipo === 'Titular' && !r.newPilotEquipo
    );
    if (invalidNewPilots.length > 0) {
      setStatus({ type: 'error', message: 'Selecciona el equipo para los pilotos nuevos titulares.' });
      return;
    }
    setIsSaving(true);
    setStatus(null);
    try {
      const aliasUpdates = collectAliasUpdates(results, pilots);
      const alias1Updates = collectAlias1Updates(results, pilots);
      const newPilots = collectNewPilots(results, metadata.division);
      const res = await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results, metadata, aliasUpdates, alias1Updates, newPilots }),
      });
      if (!res.ok) {
        let msg = 'Error al guardar';
        try { msg = (await res.json()).error || msg; } catch {}
        throw new Error(msg);
      }
      const { inserted, updated, newPilotsCreated, alias1Updated } = await res.json();
      const extras = [
        aliasUpdates.length > 0 && `${aliasUpdates.length} alias guardado(s)`,
        newPilotsCreated > 0 && `${newPilotsCreated} piloto(s) nuevo(s) registrado(s)`,
        alias1Updated > 0 && `${alias1Updated} ID oficial actualizado(s)`,
      ].filter(Boolean).join(', ');
      setStatus({
        type: 'success',
        message: `¡Guardado! ${inserted} nuevos, ${updated} actualizados.${extras ? ' ' + extras + '.' : ''}`,
      });
      if (aliasUpdates.length > 0 || newPilotsCreated > 0 || alias1Updated > 0) loadPilots();
    } catch (err: unknown) {
      setStatus({ type: 'error', message: (err as Error).message || 'Error al guardar.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setImage(null); setResults([]); setStatus(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateResult = (index: number, updates: Partial<ResultRow>) =>
    setResults((prev) => prev.map((r, i) => (i === index ? { ...r, ...updates } : r)));

  const deleteResult = (index: number) =>
    setResults((prev) =>
      prev.filter((_, i) => i !== index)
        .map((r, i) => ({ ...r, position: i + 1, points: calculatePoints(i + 1, metadata.tipoCarrera) }))
    );

  const addResult = (row: ResultRow) =>
    setResults((prev) => {
      const next = [...prev];
      next.splice(row.position - 1, 0, row);
      return next.map((r, i) => ({ ...r, position: i + 1, points: calculatePoints(i + 1, metadata.tipoCarrera) }));
    });

  if (isLoggedIn === null) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center">
        <Loader2 className="animate-spin opacity-30" size={32} />
      </div>
    );
  }

  if (!isLoggedIn) return <LoginForm onLogin={handleLogin} />;

  const hasUnresolved = results.some(
    (r) => !r.pilotId || (r.isNewPilot && r.newPilotTipo === 'Titular' && !r.newPilotEquipo)
  );

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans">
      <header className="border-b border-[#141414] px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-tighter italic font-serif">
            MRS Result System
          </h1>
          <p className="text-[10px] uppercase tracking-widest opacity-40 mt-0.5">
            Master Racing Series · F1 25 Simracing
          </p>
        </div>
        <div className="flex items-center gap-6">
          <a
            href={`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`}
            target="_blank" rel="noreferrer"
            className="text-[10px] uppercase tracking-widest opacity-40 hover:opacity-80 flex items-center gap-1 transition-opacity"
          >
            Google Sheet <ExternalLink size={10} />
          </a>
          <button
            onClick={handleLogout}
            className="text-[10px] uppercase tracking-widest opacity-40 hover:opacity-80 flex items-center gap-1.5 transition-opacity"
          >
            <LogOut size={11} /> Salir
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left column */}
        <div className="lg:col-span-4 space-y-6">
          {/* Upload */}
          <section className="space-y-3">
            <h2 className="text-[10px] font-bold uppercase tracking-widest opacity-40 border-b border-[#141414] pb-2">
              01 · Captura
            </h2>
            <div
              className={cn(
                'relative border-2 border-dashed border-[#141414] aspect-video flex flex-col items-center justify-center gap-3 overflow-hidden transition-all',
                !image && 'hover:bg-[#141414]/5 cursor-pointer'
              )}
              onClick={() => !image && fileInputRef.current?.click()}
            >
              {image ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt="Preview" className="w-full h-full object-contain" />
                  <button
                    onClick={(e) => { e.stopPropagation(); handleReset(); }}
                    className="absolute top-2 right-2 bg-[#141414] text-[#E4E3E0] px-2 py-1 text-[9px] uppercase tracking-widest"
                  >
                    Cambiar
                  </button>
                </>
              ) : (
                <>
                  <Upload className="opacity-20" size={36} />
                  <p className="text-xs uppercase tracking-widest font-bold opacity-30">Subir captura</p>
                  <p className="text-[9px] opacity-20 uppercase">PNG · JPG · WebP</p>
                </>
              )}
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
            </div>
            <button
              onClick={handleExtract}
              disabled={!image || isExtracting}
              className={cn(
                'w-full py-3 text-sm font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all',
                image && !isExtracting ? 'bg-[#141414] text-[#E4E3E0] hover:opacity-90' : 'bg-[#141414]/10 text-[#141414]/30 cursor-not-allowed'
              )}
            >
              {isExtracting ? <Loader2 size={16} className="animate-spin" /> : 'Extraer Resultados'}
            </button>
          </section>

          {/* Metadata */}
          <section className="space-y-3">
            <h2 className="text-[10px] font-bold uppercase tracking-widest opacity-40 border-b border-[#141414] pb-2">
              02 · Datos de la carrera
            </h2>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest font-bold opacity-50 flex items-center gap-1.5">
                  <MapPin size={10} /> Circuito
                </label>
                <select value={metadata.granPremio} onChange={(e) => setMetadata((m) => ({ ...m, granPremio: e.target.value }))}
                  className="w-full bg-transparent border border-[#141414] p-2.5 text-sm focus:outline-none">
                  {F1_TRACKS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest font-bold opacity-50 flex items-center gap-1.5">
                  <Users size={10} /> División
                </label>
                <select value={metadata.division} onChange={(e) => setMetadata((m) => ({ ...m, division: e.target.value }))}
                  className="w-full bg-transparent border border-[#141414] p-2.5 text-sm focus:outline-none">
                  {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest font-bold opacity-50 flex items-center gap-1.5">
                  <Calendar size={10} /> Fecha
                </label>
                <input type="date" value={metadata.fecha} onChange={(e) => setMetadata((m) => ({ ...m, fecha: e.target.value }))}
                  className="w-full bg-transparent border border-[#141414] p-2.5 text-sm focus:outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest font-bold opacity-50 flex items-center gap-1.5">
                  <Flag size={10} /> Tipo
                </label>
                <div className="flex gap-2">
                  {(['Carrera', 'Sprint'] as const).map((type) => (
                    <button key={type} onClick={() => setMetadata((m) => ({ ...m, tipoCarrera: type }))}
                      className={cn('flex-1 py-2 text-[10px] uppercase tracking-widest font-bold border border-[#141414] transition-all',
                        metadata.tipoCarrera === type ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-[#141414]/5')}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Status */}
          {status && (
            <div className={cn('p-3 flex items-start gap-2 text-xs uppercase tracking-widest font-bold',
              status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200')}>
              {status.type === 'success' ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
              <span>{status.message}</span>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex justify-between items-end border-b border-[#141414] pb-2">
            <h2 className="text-[10px] font-bold uppercase tracking-widest opacity-40">
              03 · Revisión de resultados
            </h2>
            {results.length > 0 && (
              <button onClick={handleReset}
                className="text-[10px] uppercase tracking-widest opacity-40 hover:opacity-80 flex items-center gap-1 transition-opacity">
                <RotateCcw size={10} /> Limpiar
              </button>
            )}
          </div>

          {results.length > 0 ? (
            <>
              <ResultsTable results={results} pilots={pilots} raceType={metadata.tipoCarrera}
                onUpdate={updateResult} onDelete={deleteResult} />

              <div className="space-y-1.5">
                <p className="text-[9px] uppercase tracking-widest opacity-40 font-bold">Agregar piloto manualmente</p>
                <AddPilotForm pilots={pilots} raceType={metadata.tipoCarrera} onAdd={addResult} />
              </div>

              <button onClick={handleSave} disabled={isSaving || hasUnresolved}
                className={cn('w-full py-4 font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all',
                  !isSaving && !hasUnresolved ? 'bg-[#141414] text-[#E4E3E0] hover:opacity-90' : 'bg-[#141414]/20 text-[#141414]/40 cursor-not-allowed')}>
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <><Save size={16} /> Confirmar y Guardar en Google Sheets</>}
              </button>

              {hasUnresolved && (
                <p className="text-center text-[10px] uppercase tracking-widest text-amber-600 font-bold">
                  Resuelve los pilotos marcados con ⚠️ antes de guardar
                </p>
              )}
            </>
          ) : (
            <div className="border border-dashed border-[#141414]/20 flex flex-col items-center justify-center py-24 opacity-20">
              <Upload size={48} strokeWidth={1} />
              <p className="mt-4 text-xs uppercase tracking-widest font-bold">Sin resultados</p>
              <p className="text-[10px] mt-1 uppercase">Sube una imagen y presiona Extraer</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
