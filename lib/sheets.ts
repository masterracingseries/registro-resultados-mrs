import { google } from 'googleapis';

export const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

export async function getSheetsClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

export function formatForSheets(value: string | number | null): string | number | null {
  if (typeof value === 'string' && (value.startsWith('+') || value.startsWith('='))) {
    return "'" + value;
  }
  return value;
}
