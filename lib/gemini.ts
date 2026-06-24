import { GoogleGenAI, Type } from '@google/genai';

export async function extractRaceResults(base64Image: string, mimeType = 'image/png') {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Analiza la tabla de resultados de carrera de F1 en la imagen y extrae los datos de cada piloto.

Devuelve un array JSON con exactamente estos campos por piloto:
- pos: posición final (número entero)
- piloto: nombre EXACTO del piloto tal como aparece en la imagen, sin modificar ni abreviar
- equipo: nombre del equipo
- salida: posición de largada/parrilla (número entero)
- paradas: número de paradas en boxes (número entero)
- mejor_tiempo: mejor vuelta (string, ej: "1:06,989")
- tiempo: tiempo total o diferencia (string, ej: "43:07,409" o "+1,358" o "+1 vuelta")

IMPORTANTE: Copia el nombre del piloto EXACTAMENTE como aparece en pantalla.
Solo devuelve el array JSON, sin markdown ni texto adicional.`,
          },
          { inlineData: { mimeType, data: base64Image } },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            pos: { type: Type.INTEGER },
            piloto: { type: Type.STRING },
            equipo: { type: Type.STRING },
            salida: { type: Type.INTEGER },
            paradas: { type: Type.INTEGER },
            mejor_tiempo: { type: Type.STRING },
            tiempo: { type: Type.STRING },
          },
          required: ['pos', 'piloto', 'equipo', 'salida', 'paradas', 'mejor_tiempo', 'tiempo'],
        },
      },
    },
  });

  return JSON.parse(response.text!);
}
