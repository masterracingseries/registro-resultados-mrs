import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSheetsClient, SPREADSHEET_ID } from '@/lib/sheets';

export async function GET(req: NextRequest) {
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Maestro_Pilotos!A:J',
  });

  const rows = response.data.values || [];
  const pilots = rows
    .slice(1)
    .map((row, index) => ({
      rowIndex: index + 2,
      idPilotoDivision: row[0] || '',
      idPilotoOficial: row[1] || '',
      nombreOficial: row[2] || '',
      equipoActual: row[3] || '',
      divisionActual: row[4] || '',
      statusGeneral: row[5] || '',
      alias1: row[7] || '',
      alias2: row[8] || '',
      alias3: row[9] || '',
    }))
    .filter((p) => p.idPilotoOficial);

  return NextResponse.json({ pilots });
}
