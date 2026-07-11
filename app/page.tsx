'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  ClipboardPaste,
  Sparkles,
} from 'lucide-react';
import LoginForm from '@/components/LoginForm';
import ResultsTable, { AddPilotForm } from '@/components/ResultsTable';
import { Pilot, ResultRow, RaceMetadata } from '@/types';
import { F1_TRACKS, DIVISIONS, cn } from '@/lib/constants';
import { calculatePoints } from '@/lib/points';
import {
  matchResults,
  collectAliasUpdates,
  collectAlias1Updates,
  collectNewPilots,
  collectStatusChanges,
} from '@/lib/matching';

const SPREADSHEET_ID = '11D8zcyPx3AdgPsF_pefks0hmicP3jGm22lDIZF24qAk';

type AppStatus = { type: 'success' | 'error'; message: string } | null;

// Reduce screenshots grandes (4K) para no superar el límite de request de Vercel
// y acelerar la extracción. 1920px de ancho mantiene el texto legible para la IA.
async function compressImage(file: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Formato de imagen no válido'));
    i.src = dataUrl;
  });
  const MAX_WIDTH = 1920;
  if (img.width <= MAX_WIDTH && dataUrl.length < 3_000_000) return dataUrl;
  const scale = Math.min(1, MAX_WIDTH / img.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.9);
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
  const [saved, setSaved] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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

  const handleFile = useCallback(async (file: Blob) => {
    try {
      const compressed = await compressImage(file);
      setImage(compressed);
      setResults([]);
      setSaved(false);
      setStatus(null);
    } catch (err: unknown) {
      setStatus({ type: 'error', message: (err as Error).message || 'No se pudo cargar la imagen.' });
    }
  }, []);

  // Ctrl+V: pegar screenshot directo desde el portapapeles
  useEffect(() => {
    if (!isLoggedIn) return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith('image/')
      );
      const file = item?.getAsFile();
      if (file) handleFile(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [isLoggedIn, handleFile]);

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
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) handleFile(file);
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
      const matched = matchResults(extracted, pilots, metadata.tipoCarrera, metadata.division);
      setResults(matched);
      setSaved(false);
      const ok = matched.filter((r) => r.matched).length;
      setStatus({
        type: 'success',
        message: `${extracted.length} pilotos extraídos — ${ok} con match automático.`,
      });
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
    const invalidStatusChanges = results.filter(
      (r) => r.statusChange?.newStatus === 'Titular' && (!r.team || r.team === 'Reserva')
    );
    if (invalidStatusChanges.length > 0) {
      setStatus({ type: 'error', message: 'Selecciona el equipo para los pilotos que pasan a Titular.' });
      return;
    }
    setIsSaving(true);
    setStatus(null);
    try {
      const aliasUpdates = collectAliasUpdates(results, pilots);
      const alias1Updates = collectAlias1Updates(results, pilots);
      const newPilots = collectNewPilots(results, metadata.division);
      const statusChanges = collectStatusChanges(results, pilots, metadata.division);
      const res = await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results, metadata, aliasUpdates, alias1Updates, newPilots, statusChanges }),
      });
      if (!res.ok) {
        let msg = 'Error al guardar';
        try { msg = (await res.json()).error || msg; } catch {}
        throw new Error(msg);
      }
      const { inserted, updated, newPilotsCreated, alias1Updated, statusChanged, retroRowsUpdated } = await res.json();
      const extras = [
        aliasUpdates.length > 0 && `${aliasUpdates.length} alias guardado(s)`,
        newPilotsCreated > 0 && `${newPilotsCreated} piloto(s) nuevo(s) registrado(s)`,
        alias1Updated > 0 && `${alias1Updated} ID oficial actualizado(s)`,
        statusChanged > 0 && `${statusChanged} estatus cambiado(s)`,
        retroRowsUpdated > 0 && `${retroRowsUpdated} resultado(s) anterior(es) actualizado(s)`,
      ].filter(Boolean).join(', ');
      setStatus({
        type: 'success',
        message: `Guardado: ${inserted} nuevos, ${updated} actualizados.${extras ? ' ' + extras + '.' : ''}`,
      });
      setSaved(true);
      if (aliasUpdates.length > 0 || newPilotsCreated > 0 || alias1Updated > 0 || statusChanged > 0) loadPilots();
    } catch (err: unknown) {
      setStatus({ type: 'error', message: (err as Error).message || 'Error al guardar.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setImage(null); setResults([]); setStatus(null); setSaved(false);
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
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="animate-spin opacity-30" size={32} />
      </div>
    );
  }

  if (!isLoggedIn) return <LoginForm onLogin={handleLogin} />;

  const hasUnresolved = results.some(
    (r) =>
      !r.pilotId ||
      (r.isNewPilot && r.newPilotTipo === 'Titular' && !r.newPilotEquipo) ||
      (r.statusChange?.newStatus === 'Titular' && (!r.team || r.team === 'Reserva'))
  );

  // Resumen de lo que va a pasar al guardar
  const pendingAliases = collectAliasUpdates(results, pilots).length;
  const pendingNewPilots = results.filter((r) => r.isNewPilot && r.pilotId).length;
  const pendingAlias1 = collectAlias1Updates(results, pilots).length;
  const pendingStatusChanges = collectStatusChanges(results, pilots, metadata.division).length;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="h-1 bg-accent" />
      <header className="border-b border-ink px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tight italic leading-none">
            MRS <span className="text-accent">/</span> Result System
          </h1>
          <p className="text-[11px] uppercase tracking-[0.25em] opacity-50 mt-1">
            Master Racing Series · F1 25
          </p>
        </div>
        <div className="flex items-center gap-6">
          <a
            href={`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`}
            target="_blank" rel="noreferrer"
            className="text-xs uppercase tracking-widest opacity-60 hover:opacity-100 hover:text-accent flex items-center gap-1.5 transition-all font-semibold"
          >
            Google Sheet <ExternalLink size={12} />
          </a>
          <button
            onClick={handleLogout}
            className="text-xs uppercase tracking-widest opacity-60 hover:opacity-100 flex items-center gap-1.5 transition-opacity font-semibold"
          >
            <LogOut size={13} /> Salir
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left column */}
        <div className="lg:col-span-4 space-y-8">
          {/* Upload */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] border-b-2 border-ink pb-2 flex items-baseline gap-2">
              <span className="text-accent">01</span> Captura
            </h2>
            <div
              className={cn(
                'relative border-2 border-dashed aspect-video flex flex-col items-center justify-center gap-2 overflow-hidden transition-all',
                isDragging ? 'border-accent bg-accent/5' : 'border-ink',
                !image && 'hover:bg-ink/5 cursor-pointer'
              )}
              onClick={() => !image && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              {image ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt="Captura de resultados" className="w-full h-full object-contain" />
                  <button
                    onClick={(e) => { e.stopPropagation(); handleReset(); }}
                    className="absolute top-2 right-2 bg-ink text-paper px-2.5 py-1 text-[10px] uppercase tracking-widest font-bold hover:bg-accent transition-colors"
                  >
                    Cambiar
                  </button>
                </>
              ) : (
                <>
                  <Upload className="opacity-25" size={32} />
                  <p className="text-sm font-bold uppercase tracking-wider opacity-40">
                    Subir captura
                  </p>
                  <p className="text-[11px] opacity-35 flex items-center gap-1.5">
                    <ClipboardPaste size={12} /> o pegala con Ctrl+V · arrastrala aquí
                  </p>
                </>
              )}
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
            </div>
            <button
              onClick={handleExtract}
              disabled={!image || isExtracting}
              className={cn(
                'w-full py-3.5 text-sm font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-colors',
                image && !isExtracting
                  ? 'bg-ink text-paper hover:bg-accent'
                  : 'bg-ink/10 text-ink/30 cursor-not-allowed'
              )}
            >
              {isExtracting
                ? <><Loader2 size={16} className="animate-spin" /> Analizando con IA…</>
                : <><Sparkles size={15} /> Extraer resultados</>}
            </button>
          </section>

          {/* Metadata */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] border-b-2 border-ink pb-2 flex items-baseline gap-2">
              <span className="text-accent">02</span> Datos de la carrera
            </h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest font-bold opacity-60 flex items-center gap-1.5">
                  <MapPin size={11} /> Circuito
                </label>
                <select value={metadata.granPremio} onChange={(e) => setMetadata((m) => ({ ...m, granPremio: e.target.value }))}
                  className="w-full bg-paper-raised border border-ink p-2.5 text-sm focus:outline-none focus:border-accent transition-colors cursor-pointer">
                  {F1_TRACKS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest font-bold opacity-60 flex items-center gap-1.5">
                  <Users size={11} /> División
                </label>
                <select value={metadata.division} onChange={(e) => setMetadata((m) => ({ ...m, division: e.target.value }))}
                  className="w-full bg-paper-raised border border-ink p-2.5 text-sm focus:outline-none focus:border-accent transition-colors cursor-pointer">
                  {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest font-bold opacity-60 flex items-center gap-1.5">
                  <Calendar size={11} /> Fecha
                </label>
                <input type="date" value={metadata.fecha} onChange={(e) => setMetadata((m) => ({ ...m, fecha: e.target.value }))}
                  className="w-full bg-paper-raised border border-ink p-2.5 text-sm focus:outline-none focus:border-accent transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest font-bold opacity-60 flex items-center gap-1.5">
                  <Flag size={11} /> Tipo
                </label>
                <div className="flex gap-2">
                  {(['Carrera', 'Sprint'] as const).map((type) => (
                    <button key={type} onClick={() => setMetadata((m) => ({ ...m, tipoCarrera: type }))}
                      className={cn('flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border transition-colors',
                        metadata.tipoCarrera === type
                          ? 'bg-ink text-paper border-ink'
                          : 'border-ink hover:bg-ink/5')}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Status */}
          {status && (
            <div className={cn('p-3.5 flex items-start gap-2.5 text-sm font-semibold border-l-4',
              status.type === 'success'
                ? 'bg-emerald-600/10 text-emerald-900 border-emerald-600'
                : 'bg-accent/10 text-accent border-accent')}>
              {status.type === 'success' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
              <span>{status.message}</span>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex justify-between items-end border-b-2 border-ink pb-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] flex items-baseline gap-2">
              <span className="text-accent">03</span> Revisión de resultados
            </h2>
            {results.length > 0 && (
              <button onClick={handleReset}
                className="text-[11px] uppercase tracking-widest opacity-50 hover:opacity-100 flex items-center gap-1 transition-opacity font-semibold">
                <RotateCcw size={11} /> Limpiar
              </button>
            )}
          </div>

          {results.length > 0 ? (
            <>
              <ResultsTable results={results} pilots={pilots} raceType={metadata.tipoCarrera}
                division={metadata.division} onUpdate={updateResult} onDelete={deleteResult} />

              <div className="space-y-1.5">
                <p className="text-[11px] uppercase tracking-widest opacity-50 font-bold">Agregar piloto manualmente</p>
                <AddPilotForm pilots={pilots} raceType={metadata.tipoCarrera} onAdd={addResult} />
              </div>

              {saved ? (
                <div className="border-2 border-emerald-600 bg-emerald-600/10 p-5 text-center space-y-3">
                  <p className="text-sm font-bold text-emerald-900 flex items-center justify-center gap-2">
                    <CheckCircle2 size={18} /> Resultados guardados en Google Sheets
                  </p>
                  <div className="flex justify-center gap-3">
                    <button onClick={handleReset}
                      className="bg-ink text-paper px-5 py-2.5 text-xs uppercase tracking-widest font-bold hover:bg-accent transition-colors">
                      Registrar otra carrera
                    </button>
                    <a href={`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`} target="_blank" rel="noreferrer"
                      className="border border-ink px-5 py-2.5 text-xs uppercase tracking-widest font-bold hover:bg-ink/5 transition-colors flex items-center gap-1.5">
                      Ver en el Sheet <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  <button onClick={handleSave} disabled={isSaving || hasUnresolved}
                    className={cn('w-full py-4 text-sm font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-colors',
                      !isSaving && !hasUnresolved
                        ? 'bg-ink text-paper hover:bg-accent'
                        : 'bg-ink/15 text-ink/40 cursor-not-allowed')}>
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <><Save size={16} /> Confirmar y guardar</>}
                  </button>

                  {hasUnresolved ? (
                    <p className="text-center text-xs uppercase tracking-widest text-accent font-bold">
                      Resuelve los pilotos pendientes antes de guardar
                    </p>
                  ) : (
                    <p className="text-center text-xs opacity-60">
                      Se guardarán <strong>{results.length} resultados</strong> en {metadata.division}
                      {pendingAliases > 0 && <> · {pendingAliases} alias nuevo(s)</>}
                      {pendingNewPilots > 0 && <> · {pendingNewPilots} piloto(s) nuevo(s)</>}
                      {pendingAlias1 > 0 && <> · {pendingAlias1} ID oficial actualizado(s)</>}
                      {pendingStatusChanges > 0 && <> · {pendingStatusChanges} cambio(s) de estatus</>}
                    </p>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="border-2 border-dashed border-ink/20 flex flex-col items-center justify-center py-24 opacity-30">
              <Upload size={44} strokeWidth={1} />
              <p className="mt-4 text-sm uppercase tracking-widest font-bold">Sin resultados</p>
              <p className="text-xs mt-1">Sube o pega (Ctrl+V) una captura y presiona Extraer</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
