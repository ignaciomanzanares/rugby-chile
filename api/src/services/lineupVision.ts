/**
 * Transcribe una foto de la nómina (matchday XV) a texto con Claude (visión).
 *
 * El admin sube la imagen de la formación (típicamente el gráfico de Instagram
 * del club) y Claude la lee y devuelve los 15 titulares (camisetas 1–15) + los
 * suplentes (16–23). El admin después revisa y corrige a mano en el formulario.
 *
 * Requiere ANTHROPIC_API_KEY en el entorno (Render). Si falta, la función queda
 * deshabilitada y el endpoint devuelve 503 (igual que el patrón de VAPID/push).
 */
import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
export const lineupVisionEnabled = Boolean(apiKey);

const client = apiKey ? new Anthropic({ apiKey }) : null;

export type ParsedLineup = { starters: string[]; subs: string[] };

const SUPPORTED_MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
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
  "Sos un asistente que transcribe formaciones (nóminas) de partidos de rugby chileno.",
  "Te paso la imagen de la formación de un equipo (el gráfico del 'XV titular' que publican los clubes).",
  "Devolvé SOLO los nombres de los jugadores, en orden de camiseta.",
  "Reglas:",
  "- starters: las camisetas 1 a 15 (titulares), en orden. 15 nombres.",
  "- subs: las camisetas 16 a 23 (suplentes/banca), en orden. Hasta 8 nombres.",
  "- Cada posición del arreglo corresponde a su número de camiseta (starters[0] = N°1, subs[0] = N°16).",
  "- Transcribí el nombre tal cual aparece; respetá tildes y ñ.",
  "- Si un número no aparece o el nombre es ilegible, dejá ese casillero como \"\" (string vacío).",
  "- No inventes nombres ni completes con jugadores que no estén en la imagen.",
  "- No incluyas el número de camiseta ni la posición en el nombre, solo el nombre.",
].join("\n");

const FORMAT = {
  type: "json_schema" as const,
  schema: {
    type: "object",
    properties: {
      starters: { type: "array", items: { type: "string" } },
      subs: { type: "array", items: { type: "string" } },
    },
    required: ["starters", "subs"],
    additionalProperties: false,
  },
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
  if (!client) throw new Error("ANTHROPIC_API_KEY no configurada");
  const img = parseDataUrl(dataUrl);
  if (!img) throw new Error("Imagen inválida (se espera data URL image/jpeg|png|webp)");

  const res = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 2000,
    // Transcripción acotada: no necesita razonamiento profundo, priorizamos
    // latencia/costo. Opus 5 por precisión leyendo nombres y gráficos.
    output_config: { effort: "low", format: FORMAT },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } },
          { type: "text", text: "Transcribí esta formación: 15 titulares (1-15) y los suplentes (16-23)." },
        ],
      },
    ],
  });

  if (res.stop_reason === "refusal") throw new Error("La imagen fue rechazada por el modelo");

  const text = res.content.find((b) => b.type === "text");
  const raw = text && "text" in text ? text.text : "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("No se pudo interpretar la respuesta del modelo");
  }
  const obj = (parsed ?? {}) as { starters?: unknown; subs?: unknown };
  return { starters: pad(obj.starters, 15), subs: pad(obj.subs, 8) };
}
