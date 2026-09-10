/**
 * Identidad anónima para votar la encuesta de cada partido.
 *
 * No es a prueba de balas —quien quiera puede borrar el localStorage y votar de
 * nuevo— pero corta el doble voto casual, que es de lo que se trata. El servidor
 * usa esta clave para saber qué votó cada uno y para que cambiar de opinión pise
 * el voto anterior en vez de sumar otro.
 */
const KEY = "top10_voter_id";

export function voterId(): string {
  if (typeof window === "undefined") return "";
  try {
    const guardado = localStorage.getItem(KEY);
    if (guardado) return guardado;
    const nuevo = crypto.randomUUID();
    localStorage.setItem(KEY, nuevo);
    return nuevo;
  } catch {
    // Navegación privada o storage bloqueado: se vota igual, sin persistir.
    return "anon-" + Math.random().toString(36).slice(2, 12);
  }
}
