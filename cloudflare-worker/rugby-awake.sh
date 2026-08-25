#!/usr/bin/env bash
# Mantiene la laptop DESPIERTA (no suspende, aunque cierres la tapa) durante la
# jornada de partidos, para que el proxy del minuto-a-minuto siga sirviendo por tu
# IP residencial. La pantalla igual se apaga al cerrar la tapa (ahorra energía);
# solo evitamos el suspend del sistema. No cambia tu config normal: al vencer el
# plazo (o al reiniciar) vuelve todo a lo de siempre.
#
# Uso, antes de irte:   ./rugby-awake.sh        (9 horas por defecto)
#                       ./rugby-awake.sh 8      (8 horas)
# Cortar antes:         pkill -f 'systemd-inhibit.*rugby'
HORAS="${1:-9}"
pkill -f 'systemd-inhibit.*rugby' 2>/dev/null || true
setsid systemd-inhibit --what=sleep:idle:handle-lid-switch \
  --why="rugby minuto-a-minuto en vivo" --mode=block \
  sleep "${HORAS}h" >/dev/null 2>&1 &
disown
echo "✅ Laptop despierta por ${HORAS}h."
echo "   Enchufala, cerrá la tapa y andate tranquilo — el proxy sigue sirviendo."
echo "   (Cortar antes:  pkill -f 'systemd-inhibit.*rugby')"
