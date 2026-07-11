import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSheetsClient, SPREADSHEET_ID, formatForSheets } from '@/lib/sheets';
import { ResultRow, RaceMetadata, AliasUpdate, Alias1Update, NewPilot } from '@/types';

// Varias escrituras secuenciales a Sheets pueden superar el timeout default
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: {
    results: ResultRow[];
    metadata: RaceMetadata;
    aliasUpdates: AliasUpdate[];
    alias1Updates: Alias1Update[];
    newPilots: NewPilot[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }
  const { results, metadata, aliasUpdates, alias1Updates, newPilots } = body;

  let sheets: Awaited<ReturnType<typeof getSheetsClient>>;
  try {
    sheets = await getSheetsClient();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[results] sheets auth error:', msg);
    return NextResponse.json({ error: `Error de autenticación con Google Sheets: ${msg}` }, { status: 500 });
  }
  const { granPremio, division, fecha, tipoCarrera } = metadata;
  const timestamp = new Date().toISOString();
  const divNum = division.replace(/División\s*/i, '');

  try {
  // 1. Add new pilots to Maestro_Pilotos (insert after last row with data in col H = Alias_1)
  if (newPilots && newPilots.length > 0) {
    const colHRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Maestro_Pilotos!H:H',
    });
    const colH = colHRes.data.values || [];
    let lastDataRow = 1;
    for (let i = 0; i < colH.length; i++) {
      if (colH[i]?.[0]) lastDataRow = i + 1;
    }

    // Write C:J only — A and B already have formulas pre-populated to row 1000
    // C='', D=equipo, E=division, F=tipo, G='Activo', H=alias1, I='', J=''
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: newPilots.map(({ alias1, division: div, tipo, equipo }, i) => ({
          range: `Maestro_Pilotos!C${lastDataRow + 1 + i}:J${lastDataRow + 1 + i}`,
          values: [['', equipo, div, tipo, 'Activo', alias1, '', '']],
        })),
      },
    });
  }

  // 2. Update alias_1 for pilots with name change (also saves old alias_1 to alias_2/3)
  if (alias1Updates && alias1Updates.length > 0) {
    const alias1Data: { range: string; values: string[][] }[] = [];
    alias1Updates.forEach(({ rowIndices, newAlias1, oldAlias1, oldAlias1Column }) => {
      rowIndices.forEach((rowIndex) => {
        alias1Data.push({ range: `Maestro_Pilotos!H${rowIndex}`, values: [[newAlias1]] });
        if (oldAlias1Column) {
          alias1Data.push({ range: `Maestro_Pilotos!${oldAlias1Column}${rowIndex}`, values: [[oldAlias1]] });
        }
      });
    });
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: 'USER_ENTERED', data: alias1Data },
    });
  }

  // 3. Build result rows
  const rows = results.map((r) => {
    const idPiloto = r.pilotId || 'NO_REGISTRADO';
    const idResultado = `${granPremio.toUpperCase().replace(/\s/g, '')}-DIV${divNum}-${idPiloto}`;
    const row = Array(16).fill('');
    row[0] = idResultado;
    row[1] = timestamp;
    row[2] = granPremio;
    row[3] = division;
    row[4] = tipoCarrera;
    row[5] = fecha;
    row[6] = idPiloto;
    row[7] = r.pilotName;
    row[8] = r.team;
    row[9] = r.position;
    row[10] = r.grid ?? '';
    row[11] = r.stops ?? '';
    row[12] = formatForSheets(r.bestLap) ?? '';
    row[13] = formatForSheets(r.time) ?? '';
    row[14] = tipoCarrera === 'Sprint' ? r.points : 0;
    row[15] = tipoCarrera === 'Carrera' ? r.points : 0;
    return row;
  });

  // Upsert logic
  const existingRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Resultados_Crudos!A:A',
  });
  const existingIds = new Map(
    (existingRes.data.values || []).map((row, idx) => [row[0], idx + 1])
  );

  const toAppend = rows.filter((r) => !existingIds.has(r[0] as string));
  const toUpdate = rows
    .filter((r) => existingIds.has(r[0] as string))
    .map((r) => ({
      range: `Resultados_Crudos!A${existingIds.get(r[0] as string)}`,
      values: [r],
    }));

  if (toAppend.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Resultados_Crudos!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: toAppend },
    });
  }

  if (toUpdate.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: 'USER_ENTERED', data: toUpdate },
    });
  }

  // 4. Save aliases (alias_2 / alias_3 for manually matched pilots)
  if (aliasUpdates && aliasUpdates.length > 0) {
    const aliasData = aliasUpdates.flatMap(({ rowIndices, column, value }) =>
      rowIndices.map((rowIndex) => ({
        range: `Maestro_Pilotos!${column}${rowIndex}`,
        values: [[value]],
      }))
    );
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: 'USER_ENTERED', data: aliasData },
    });
  }

  return NextResponse.json({
    ok: true,
    inserted: toAppend.length,
    updated: toUpdate.length,
    newPilotsCreated: newPilots?.length ?? 0,
    alias1Updated: alias1Updates?.length ?? 0,
  });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[results]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
