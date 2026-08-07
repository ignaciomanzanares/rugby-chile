/**
 * Transcribe una foto de la nómina (matchday XV) a texto con Gemini (visión).
 *
 * El admin sube la imagen de la formación (típicamente el gráfico de Instagram
 * del club) y el modelo la lee y devuelve los 15 titulares (camisetas 1–15) +
 * los suplentes (16–23). El admin después revisa y corrige a mano.
 *
 * Requiere GEMINI_API_KEY en el entorno (Render; key de Google AI Studio). Si
 * falta, la función queda deshabilitada y el endpoint devuelve 503 (igual que el
 * patrón de VAPID/push). Gemini Flash tiene tier gratis para este volumen.
 */
import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
export const lineupVisionEnabled = Boolean(apiKey);

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = "gemini-2.5-flash";

export type ParsedLineup = { starters: string[]; subs: string[] };

const SUPPORTED_MEDIA = ["image/jpeg", "image/png", "image/webp"] as const;
type MediaType = (typeof SUPPORTED_MEDIA)[number];

// data URL ("data:image/jpeg;base64,....") → { mediaType, data }
export function parseDataUrl(dataUrl: string): { mediaType: MediaType; data: string } | null {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const mediaType = m[1].toLowerCase() as MediaType;
  if (!SUPPORTED_MEDIA.includes(mediaType)) return null;
  return { mediaType, data: m[2] };
}

const SYSTEM = [
  "Transcribís formaciones (nóminas) de partidos de rugby chileno a partir de la imagen que publican los clubes.",
  "Devolvé SOLO los nombres de jugadores, ordenados por número de camiseta.",
  "- starters: camisetas 1 a 15 (15 nombres).",
  "- subs: camisetas 16 a 23 (hasta 8; puede haber menos, ej. solo 16-22).",
  "- El índice del arreglo ES el número de camiseta: starters[0]=N°1 … starters[14]=N°15; subs[0]=N°16 … subs[7]=N°23.",
  "",
  "Los formatos varían mucho entre clubes. Cómo leer:",
  "- El NÚMERO impreso manda, no el orden de lectura. Si está en dos columnas o en una grilla de fotos, ubicá cada nombre por su número de camiseta.",
  "- La numeración puede venir como '1.', '1.-', '1' o el número sobre/junto a una foto. Ignorá el separador.",
  "- Nombre invertido: si aparece 'APELLIDO, Nombre' (apellido primero, con coma), devolvelo como 'Nombre Apellido'.",
  "- Si aparece 'Nombre Apellido' o 'Inicial. Apellido' (ej. 'F. Bastías'), devolvelo tal cual.",
  "- Respetá tildes y ñ. Capitalizá como nombre propio: 'M. HARTTIG' → 'M. Harttig', 'DELGADO, CARLOS' → 'Carlos Delgado'.",
  "- Quitá del nombre cualquier marca de capitán o rol: '(C)', '(c)', '(cap)'. El nombre va limpio.",
  "- Suplentes sin número: a veces la banca viene en una línea aparte separada por '/' o ',' y sin número (ej. 'Olmos, C. / Jerez, P. / …'). Asignalos en orden a 16, 17, 18, …",
  "- Placeholders: si un casillero dice 'TBD', 'TBC', 'A confirmar', 'Por confirmar' o similar, dejá ese casillero como \"\" (vacío).",
  "- NO incluyas cuerpo técnico (head coach, coach, forwards, manager, kinesiólogo, preparador físico, etc.), solo jugadores.",
  "- No inventes ni completes jugadores que no estén en la imagen; si un nombre es ilegible, dejá \"\".",
  "- No pongas el número ni la posición dentro del nombre, solo el nombre.",
].join("\n");

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    starters: { type: Type.ARRAY, items: { type: Type.STRING } },
    subs: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["starters", "subs"],
};

function pad(arr: unknown, n: number): string[] {
  const out = Array.from({ length: n }, () => "");
  if (Array.isArray(arr)) {
    for (let i = 0; i < Math.min(n, arr.length); i++) {
      out[i] = typeof arr[i] === "string" ? (arr[i] as string).trim() : "";
    }
  }
  return out;
}

export async function parseLineupImage(dataUrl: string): Promise<ParsedLineup> {
  if (!ai) throw new Error("GEMINI_API_KEY no configurada");
  const img = parseDataUrl(dataUrl);
  if (!img) throw new Error("Imagen inválida (se espera data URL image/jpeg|png|webp)");

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: img.mediaType, data: img.data } },
          { text: "Transcribí esta formación: 15 titulares (1-15) y los suplentes (16-23)." },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM,
      temperature: 0,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      // Algo de razonamiento ayuda con dos columnas / nombres invertidos, pero
      // acotado para que no se coma el presupuesto de salida.
      thinkingConfig: { thinkingBudget: 1024 },
    },
  });

  const raw = res.text ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("No se pudo interpretar la respuesta del modelo");
  }
  const obj = (parsed ?? {}) as { starters?: unknown; subs?: unknown };
  return { starters: pad(obj.starters, 15), subs: pad(obj.subs, 8) };
}
