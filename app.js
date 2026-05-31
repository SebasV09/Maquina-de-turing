'use strict';

/* ============================================================
   MOTOR: CLASE TuringMachine
   ─────────────────────────────────────────────────────────────
   Implementa el modelo formal de una MT determinista.
   Independiente de la UI — puede usarse en cualquier contexto.
============================================================ */
class TuringMachine {

  constructor() {
    this.tape = {};     // cinta dispersa: { pos(int) → símbolo(char) }
    this.head = 0;     // posición actual del cabezal
    this.state = 'q0';  // estado actual
    this.transitions = {};    // función δ: { "estado,símbolo" → {next,write,move} }
    this.steps = 0;     // pasos ejecutados
    this.maxSteps = 1000;  // límite anti-bucle
    this.stepLog = [];    // historial de configuraciones
    this.halted = false; // ¿la MT se detuvo?
    this.result = null;  // 'accept' | 'reject' | 'timeout'
    this.lastApplied = null;  // última transición aplicada (para la UI)
    this.acceptState = 'q_accept';
    this.rejectState = 'q_reject';
  }

  /* Lee el símbolo en `pos` — devuelve '#' si la celda está vacía */
  read(pos) {
    return (this.tape[pos] !== undefined) ? this.tape[pos] : '#';
  }

  /* Escribe `sym` en `pos`. Si sym === '#', elimina la entrada para cinta limpia */
  write(pos, sym) {
    if (sym === '#') delete this.tape[pos];
    else this.tape[pos] = sym;
  }

  /* Carga la cinta desde una cadena y reinicia todos los contadores */
  loadTape(str, headStart = 0, startState = 'q0') {
    this.tape = {};
    this.head = parseInt(headStart) || 0;
    this.state = startState;
    this.steps = 0;
    this.stepLog = [];
    this.halted = false;
    this.result = null;
    this.lastApplied = null;
    for (let i = 0; i < str.length; i++) {
      if (str[i] !== '#') this.tape[i] = str[i];
    }
  }

  /* Carga la función de transición desde un arreglo de 5-tuplas:
     [ [estado, lee, nuevo_estado, escribe, mueve], ... ] */
  setTransitions(arr) {
    this.transitions = {};
    for (const [state, read, next, write, move] of arr) {
      const key = `${state.trim()},${read.trim()}`;
      this.transitions[key] = {
        next: next.trim(),
        write: write.trim(),
        move: move.trim().toUpperCase()
      };
    }
  }

  /*
   * step() — Ejecuta UN paso de la MT.
   * ─────────────────────────────────────────────────────────────
   * ① Si ya está detenida → retorna 'halted'
   * ② Si el estado es q_accept/q_reject → detiene y retorna
   * ③ Lee símbolo y busca transición
   * ④ Sin transición → configuración bloqueante → rechazo implícito
   * ⑤ Registra paso, aplica transición (escribe, cambia estado, mueve)
   * ⑥ Verifica límite de pasos (timeout)
   * ⑦ Verifica si el nuevo estado es final
   * ⑧ Retorna 'continue'
   *
   * Retorna: 'continue' | 'accept' | 'reject' | 'timeout' | 'halted'
   */
  step() {
    if (this.halted) return 'halted';

    // ① Estados finales: comprobar ANTES de leer
    if (this.state === this.acceptState) { this._logAndHalt('accept'); return 'accept'; }
    if (this.state === this.rejectState) { this._logAndHalt('reject'); return 'reject'; }

    // ② Leer símbolo y buscar transición
    const sym = this.read(this.head);
    const key = `${this.state},${sym}`;
    const t = this.transitions[key];

    // ③ Sin transición → configuración bloqueante → rechazo implícito
    if (!t) {
      this.stepLog.push({
        step: this.steps, state: this.state,
        head: this.head, sym, key,
        applied: null, halted: 'reject'
      });
      this.lastApplied = null;
      this._halt('reject');
      return 'reject';
    }

    // ④ Registrar la configuración ANTES de aplicar (para el log educativo)
    this.stepLog.push({
      step: this.steps, state: this.state,
      head: this.head, sym, key,
      applied: { ...t }
    });

    // ⑤ Aplicar transición
    this.lastApplied = { from: this.state, sym, key, ...t };
    this.write(this.head, t.write);
    this.state = t.next;

    if (t.move === 'L') this.head--;
    else if (t.move === 'R') this.head++;
    // 'S' = Stay (quedarse)

    this.steps++;

    // ⑥ Verificar límite de pasos
    if (this.steps >= this.maxSteps) { this._halt('timeout'); return 'timeout'; }

    // ⑦ Comprobar si llegamos a un estado final tras la transición
    if (this.state === this.acceptState) { this._halt('accept'); return 'accept'; }
    if (this.state === this.rejectState) { this._halt('reject'); return 'reject'; }

    return 'continue';
  }

  /* Registra el estado actual como entrada de halt y detiene */
  _logAndHalt(result) {
    this.stepLog.push({
      step: this.steps, state: this.state,
      head: this.head, sym: this.read(this.head),
      key: '—', applied: null, halted: result
    });
    this._halt(result);
  }

  _halt(result) {
    this.halted = true;
    this.result = result;
  }

  /* Devuelve las celdas visibles en [center-radius, center+radius] */
  getCells(center, radius) {
    const cells = [];
    for (let p = center - radius; p <= center + radius; p++) {
      cells.push({ pos: p, sym: this.read(p), isHead: p === this.head });
    }
    return cells;
  }
}


/* ============================================================
   EJEMPLOS PRECARGADOS
   ─────────────────────────────────────────────────────────────
   Cada entrada es un objeto con: input, head, transitions[] y description.
   Para añadir un nuevo ejemplo: copia una entrada, ajusta los datos y
   añade un <button onclick="loadExample('nombre')"> en el HTML.
============================================================ */
const EXAMPLES = {

  /* ─── Suma Unaria ─── */
  unary_add: {
    label: 'Suma Unaria',
    input: '111+11',
    head: 0,
    startState: 'q0',
    acceptState: 'q_accept',
    rejectState: 'q_reject',
    transitions: [
      ['q0', '1', 'q0', '1', 'R'],  // avanzar sobre 1s del 1er número
      ['q0', '+', 'q1', '1', 'R'],  // reemplazar '+' por '1', continuar
      ['q1', '1', 'q1', '1', 'R'],  // avanzar sobre 1s del 2do número
      ['q1', '#', 'q2', '#', 'L'],  // fin de cinta → retroceder
      ['q2', '1', 'q_accept', '#', 'S'],  // borrar último '1' y aceptar
    ],
    description:
      '➕  Suma dos números en notación UNARIA separados por "+".\n' +
      '   Estrategia: convierte "+" en un "1" extra y borra el último "1" para compensar.\n' +
      '   Entrada: 111 + 11  (representa 3 + 2)\n' +
      '   Salida:  11111     (representa 5)\n' +
      'Prueba también: "1+1111" (1+4), "11+1" (2+1).'
  },

  /* ─── Par de Unos ─── */
  even_ones: {
    label: 'Par de Unos',
    input: '10110',
    head: 0,
    startState: 'q0',
    acceptState: 'q_accept',
    rejectState: 'q_reject',
    transitions: [
      ['q0', '0', 'q0', '0', 'R'],  // ignorar cero (paridad par)
      ['q0', '1', 'q1', '1', 'R'],  // leer 1 → cambiar a impar
      ['q0', '#', 'q_accept', '#', 'S'],  // fin con paridad par → ACEPTAR
      ['q1', '0', 'q1', '0', 'R'],  // ignorar cero (paridad impar)
      ['q1', '1', 'q0', '1', 'R'],  // leer 1 → cambiar a par
      ['q1', '#', 'q_reject', '#', 'S'],  // fin con paridad impar → RECHAZAR
    ],
    description:
      '🔢  Acepta cadenas {0,1} con número PAR de unos.\n' +
      '   q0 = cantidad par de 1s  •  q1 = cantidad impar de 1s\n' +
      '   Equivalente a un AFD de 2 estados.\n' +
      'Prueba: "1010" (2 unos → ✓)  •  "10110" (3 unos → ✗)  •  "1111" (4 → ✓).'
  },

  /* ─── Palíndromos sobre {a, b} ─── */
  palindrome: {
    label: 'Palíndromo',
    input: 'abba',
    head: 0,
    startState: 'q0',
    acceptState: 'q_accept',
    rejectState: 'q_reject',
    transitions: [
      // q0: leer símbolo izquierdo y borrarlo
      ['q0', 'a', 'q1', '#', 'R'],
      ['q0', 'b', 'q2', '#', 'R'],
      ['q0', '#', 'q_accept', '#', 'S'],  // cinta vacía → palíndromo ✓
      // q1/q2: avanzar al extremo derecho
      ['q1', 'a', 'q1', 'a', 'R'],
      ['q1', 'b', 'q1', 'b', 'R'],
      ['q1', '#', 'q3', '#', 'L'],       // llegó al borde → verificar 'a'
      ['q2', 'a', 'q2', 'a', 'R'],
      ['q2', 'b', 'q2', 'b', 'R'],
      ['q2', '#', 'q4', '#', 'L'],       // llegó al borde → verificar 'b'
      // q3: comprobar símbolo derecho esperando 'a'
      ['q3', 'a', 'q5', '#', 'L'],
      ['q3', 'b', 'q_reject', 'b', 'S'],
      ['q3', '#', 'q_accept', '#', 'S'],  // un solo símbolo central ✓
      // q4: comprobar símbolo derecho esperando 'b'
      ['q4', 'b', 'q5', '#', 'L'],
      ['q4', 'a', 'q_reject', 'a', 'S'],
      ['q4', '#', 'q_accept', '#', 'S'],  // un solo símbolo central ✓
      // q5: volver al borde izquierdo
      ['q5', 'a', 'q5', 'a', 'L'],
      ['q5', 'b', 'q5', 'b', 'L'],
      ['q5', '#', 'q0', '#', 'R'],       // reiniciar ciclo
    ],
    description:
      '🔄  Reconoce palíndromos sobre {a, b}.\n' +
      '   Borra el símbolo más a la izquierda y el más a la derecha comparándolos.\n' +
      'Prueba: "abba" (✓) · "aba" (✓) · "ab" (✗) · "aabbaa" (✓) · "abab" (✗).'
  },

  /* ─── Incremento Binario ─── */
  binary_increment: {
    label: 'Incremento Binario',
    input: '1011',
    head: 0,
    startState: 'q0',
    acceptState: 'q_accept',
    rejectState: 'q_reject',
    transitions: [
      ['q0', '0', 'q0', '0', 'R'],  // avanzar al final de la cinta
      ['q0', '1', 'q0', '1', 'R'],
      ['q0', '#', 'q1', '#', 'L'],  // al llegar al blanco retroceder incrementando
      ['q1', '1', 'q1', '0', 'L'],  // 1 + 1 = 0 y llevo 1
      ['q1', '0', 'q_accept', '1', 'S'],  // 0 + 1 = 1 y termina
      ['q1', '#', 'q_accept', '1', 'S'],  // # + 1 = 1 y termina
    ],
    description:
      '🔢  Suma 1 a un número BINARIO.\n' +
      '   Estrategia: Se desplaza a la derecha hasta el final del número y luego retrocede hacia la izquierda sumando.\n' +
      '   Entrada: 1011  (representa 11 en binario)\n' +
      '   Salida:  1100  (representa 12 en binario).'
  },

  /* ─── Validador de Paréntesis ─── */
  parentheses_match: {
    label: 'Validador de Paréntesis',
    input: '(()())',
    head: 0,
    startState: 'q0',
    acceptState: 'q_accept',
    rejectState: 'q_reject',
    transitions: [
      // q0: buscar el primer paréntesis de cierre ')'
      ['q0', '(', 'q0', '(', 'R'],
      ['q0', 'X', 'q0', 'X', 'R'],
      ['q0', ')', 'q1', 'X', 'L'],  // encontrado ')', lo marca con 'X' e inicia búsqueda del '(' correspondiente
      ['q0', '#', 'q2', '#', 'L'],  // no hay más ')', verificar si queda algún '(' abierto
      // q1: buscar el '(' correspondiente yendo a la izquierda
      ['q1', 'X', 'q1', 'X', 'L'],
      ['q1', '(', 'q0', 'X', 'R'],  // emparejado con '(', lo marca con 'X' y vuelve a escanear a la derecha
      ['q1', '#', 'q_reject', '#', 'S'],  // llegó al inicio de la cinta sin emparejar '(' → RECHAZA
      // q2: comprobar que no queden '(' sin emparejar
      ['q2', 'X', 'q2', 'X', 'L'],
      ['q2', '#', 'q_accept', '#', 'S'],  // todo balanceado → ACEPTA
      ['q2', '(', 'q_reject', '(', 'S'],  // queda algún '(' sin cerrar → RECHAZA
    ],
    description:
      '()  Verifica si los paréntesis en la cadena están balanceados.\n' +
      '   Estrategia: Busca el primer ")" a la derecha, lo marca con "X" y regresa a la izquierda a emparejarlo con su "(" correspondiente. Repite hasta terminar.\n' +
      '   Prueba: "(()())" (✓) · "(())" (✓) · "(()" (✗) · "())" (✗).'
  }
};


/* ============================================================
   ESTADO GLOBAL DE LA UI
============================================================ */
const tm = new TuringMachine();
let runInterval = null;   // referencia al setInterval del modo automático
let isRunning = false;  // ¿se está ejecutando en modo automático?
let prevHead = 0;      // posición anterior del cabezal para animaciones
let initialMachineState = 'q0'; // estado inicial persistente para reinicios
let logRenderedCount = 0;    // cuántas entradas de stepLog ya están en el DOM


/* ============================================================
   RENDER — CINTA
============================================================ */
function renderTape() {
  const container = document.getElementById('tape-cells-container');
  const marker = document.getElementById('tape-head-marker');
  const arrowInd = document.getElementById('head-arrow-indicator');
  const nextInd = document.getElementById('head-next-indicator');

  // Obtener las posiciones de la cinta escrita
  const writtenPositions = Object.keys(tm.tape).map(Number);
  const headPos = tm.head;
  const initialLength = (document.getElementById('tape-input').value || '').length;

  // Rango estable alrededor del cabezal
  let minPos = Math.min(0, headPos, ...writtenPositions) - 6;
  let maxPos = Math.max(initialLength - 1, headPos, ...writtenPositions) + 6;

  // Renderizar las celdas
  container.innerHTML = '';
  for (let p = minPos; p <= maxPos; p++) {
    const sym = tm.read(p);
    const cell = document.createElement('div');
    cell.className = 'tape-cell' + (sym === '#' ? ' blank' : '');
    cell.id = `cell-${p}`;

    const dist = Math.abs(p - headPos);
    if (dist === 1) {
      cell.classList.add('neighbor');
    }

    cell.innerHTML = `<span>${sym}</span><span class="cell-pos">${p}</span>`;
    container.appendChild(cell);
  }

  // Leer ancho de celda y gap desde CSS
  const computedStyle = getComputedStyle(document.documentElement);
  const cellWidth = parseInt(computedStyle.getPropertyValue('--cell-width')) || 60;
  const cellGap = parseInt(computedStyle.getPropertyValue('--cell-gap')) || 8;

  // Posicionar de manera absoluta el marcador
  const cellIndex = headPos - minPos;
  const leftPos = 20 + cellIndex * (cellWidth + cellGap); // 20px de padding interno del container

  marker.style.left = `${leftPos}px`;
  marker.style.width = `${cellWidth}px`;
  marker.style.height = `${cellWidth * 1.1}px`;

  // Sincronizar .hs-center encima de la celda activa
  const hsCenter = document.getElementById('hs-center-tape');
  if (hsCenter) {
    const cellCenterX = leftPos + cellWidth / 2;
    hsCenter.style.position = 'absolute';
    hsCenter.style.left = `${cellCenterX}px`;
    hsCenter.style.top = `${-cellWidth * 0.6}px`;
    hsCenter.style.transform = 'translateX(-50%)';
    hsCenter.style.pointerEvents = 'none';
    hsCenter.style.zIndex = '11';
  }

  // Animación del cabezal (inclinación y flecha deslizable)
  marker.classList.remove('moving-left', 'moving-right');
  arrowInd.textContent = '';

  if (headPos > prevHead) {
    arrowInd.textContent = '→';
    marker.classList.add('moving-right');
  } else if (headPos < prevHead) {
    arrowInd.textContent = '←';
    marker.classList.add('moving-left');
  }
  prevHead = headPos;

  // Previsualización del próximo movimiento (Semáforo)
  const sym = tm.read(headPos);
  const key = `${tm.state},${sym}`;
  const t = tm.transitions[key];

  marker.className = 'tape-head-marker';
  nextInd.className = 'head-next-indicator';

  if (tm.halted || tm.state === tm.acceptState || tm.state === tm.rejectState) {
    marker.classList.add('head-next-H');
    nextInd.classList.add('next-halt');
    nextInd.innerHTML = '🛑 FIN';
    nextInd.title = 'Simulación finalizada';
  } else if (t) {
    if (t.move === 'R') {
      marker.classList.add('head-next-R');
      nextInd.classList.add('next-right');
      nextInd.innerHTML = '→ R';
      nextInd.title = `Siguiente paso: escribe '${t.write}', va a ${t.next}, mueve a la Derecha`;
    } else if (t.move === 'L') {
      marker.classList.add('head-next-L');
      nextInd.classList.add('next-left');
      nextInd.innerHTML = '← L';
      nextInd.title = `Siguiente paso: escribe '${t.write}', va a ${t.next}, mueve a la Izquierda`;
    } else {
      marker.classList.add('head-next-S');
      nextInd.classList.add('next-stay');
      nextInd.innerHTML = '● S';
      nextInd.title = `Siguiente paso: escribe '${t.write}', va a ${t.next}, se queda`;
    }
  } else {
    marker.classList.add('head-next-H');
    nextInd.classList.add('next-halt');
    nextInd.innerHTML = '🛑 ALTO';
    nextInd.title = 'Sin transición definida para este estado y símbolo (Alto)';
  }

  // Centrar el cabezal en el track mediante scroll automático
  const activeCell = document.getElementById(`cell-${headPos}`);
  if (activeCell) {
    const track = document.getElementById('tape-track');
    const scrollLeftDest = activeCell.offsetLeft - (track.clientWidth / 2) + (cellWidth / 2) + 20;
    track.scrollTo({ left: scrollLeftDest, behavior: 'smooth' });
  }
}


/* ============================================================
   RENDER — BARRA DE ESTADO DEL CABEZAL
   ─────────────────────────────────────────────────────────────
   Muestra el ESTADO ANTERIOR (izquierda) y el ACTUAL (derecha).
============================================================ */
function renderHeadStates() {
  const prevEl = document.getElementById('hs-prev');
  const currEl = document.getElementById('hs-curr');
  const transEl = document.getElementById('hs-trans');
  const t = tm.lastApplied;

  if (t) {
    prevEl.textContent = t.from;
    prevEl.className = 'hs-val' + (
      t.from === tm.acceptState ? ' hs-accept' :
        t.from === tm.rejectState ? ' hs-reject' : ''
    );
    transEl.textContent = `'${t.sym}' → '${t.write}' ${t.move === 'L' ? '←' : t.move === 'R' ? '→' : '●'
      }`;
    transEl.className = 'hs-trans has-trans';
  } else {
    prevEl.textContent = '—';
    prevEl.className = 'hs-val';
    transEl.textContent = '';
    transEl.className = 'hs-trans';
  }

  currEl.textContent = tm.state;
  currEl.className =
    'hs-val' +
    (tm.state === tm.acceptState ? ' hs-accept' :
      tm.state === tm.rejectState ? ' hs-reject' : '');
}


/* ============================================================
   RENDER — PANEL DE ESTADO (estado, símbolo leído, pasos)
============================================================ */
function renderStatus() {
  const stateEl = document.getElementById('s-state');
  stateEl.textContent = tm.state;
  stateEl.className =
    'stat-val' +
    (tm.state === tm.acceptState ? ' state-accept' :
      tm.state === tm.rejectState ? ' state-reject' : '');

  document.getElementById('s-sym').textContent = tm.read(tm.head);
  document.getElementById('s-steps').textContent = tm.steps;

  // Mantener sincronizado el input del estado actual si no se está ejecutando en automático
  const stateInput = document.getElementById('state-input');
  if (stateInput && document.activeElement !== stateInput) {
    stateInput.value = tm.state;
  }
}


/* ============================================================
   RENDER — ÚLTIMA TRANSICIÓN APLICADA
============================================================ */
function renderTransInfo() {
  const el = document.getElementById('trans-info');
  const t = tm.lastApplied;

  if (!t) {
    el.className = 'trans-info-box no-trans';
    el.textContent = 'Sin transición aplicada aún — presiona «Paso a paso» para comenzar';
    return;
  }

  const mv = { L: '← Izquierda', R: '→ Derecha', S: '● Quedarse' }[t.move] || t.move;
  el.className = 'trans-info-box';
  el.innerHTML =
    `<span class="ti-from">(${t.from},&thinsp;'${t.sym}')</span>` +
    `<span class="ti-arrow">⟶</span>` +
    `<span class="ti-to">(${t.next},&thinsp;'${t.write}',&thinsp;</span>` +
    `<span class="ti-move">${mv}</span>` +
    `<span class="ti-to">)</span>`;
}


/* ============================================================
   RENDER — BANNER DE RESULTADO
============================================================ */
function renderResult() {
  const banner = document.getElementById('result-banner');
  banner.className = '';

  if (!tm.halted) return;

  const msgs = {
    accept: `✅  CADENA ACEPTADA — la máquina alcanzó el estado de aceptación (${tm.acceptState}).`,
    reject: `❌  CADENA RECHAZADA — alcanzó el estado de rechazo (${tm.rejectState}) o no existe transición definida.`,
    timeout: `⚠️  LÍMITE DE PASOS (${tm.maxSteps}) — posible bucle infinito detectado.`
  };
  banner.textContent = msgs[tm.result] || '';
  banner.className = `visible ${tm.result}`;

  // Al terminar: abrir panel flotante y mostrar el recorrido
  renderPathVisualization();
  openLogPanel();
}


/* ============================================================
   RENDER — RECORRIDO DE ESTADOS (en el panel flotante)
   ─────────────────────────────────────────────────────────────
   Comprime los estados consecutivos repetidos usando un contador.
   Ej: q0,q0,q0,q1,q1,q_accept → [q0×3] → [q1×2] → [q_accept ✓]
============================================================ */
function getCompressedPath() {
  const path = [];
  tm.stepLog.forEach(entry => {
    const last = path[path.length - 1];
    if (last && last.state === entry.state) {
      last.count++;
    } else {
      path.push({ state: entry.state, count: 1, halted: entry.halted || null });
    }
  });
  return path;
}

function renderPathVisualization() {
  const pathSection = document.getElementById('fp-path');
  const flowEl = document.getElementById('fp-path-flow');
  const summaryEl = document.getElementById('fp-path-summary');

  if (!tm.halted || tm.stepLog.length === 0) {
    pathSection.classList.remove('visible');
    return;
  }

  const path = getCompressedPath();
  flowEl.innerHTML = '';

  path.forEach((node, i) => {
    // Nodo de estado
    const isFinal = (i === path.length - 1);
    const cls = isFinal
      ? (tm.result === 'accept' ? 'path-accept'
        : tm.result === 'reject' ? 'path-reject'
          : tm.result === 'timeout' ? 'path-timeout' : '')
      : '';

    const div = document.createElement('div');
    div.className = `path-node ${cls}`;
    div.innerHTML = node.state +
      (node.count > 1
        ? `<span class="path-count">×${node.count}</span>`
        : '') +
      (isFinal && tm.result === 'accept' ? ' ✓' :
        isFinal && tm.result === 'reject' ? ' ✗' :
          isFinal && tm.result === 'timeout' ? ' ⚠' : '');
    flowEl.appendChild(div);

    // Flecha entre nodos (no después del último)
    if (i < path.length - 1) {
      const arrow = document.createElement('span');
      arrow.className = 'path-arrow';
      arrow.textContent = '→';
      flowEl.appendChild(arrow);
    }
  });

  // Resumen
  const resultLabels = {
    accept: { text: 'ACEPTADA ✓', cls: 'accept' },
    reject: { text: 'RECHAZADA ✗', cls: 'reject' },
    timeout: { text: 'TIMEOUT ⚠', cls: 'timeout' },
  };
  const rl = resultLabels[tm.result] || { text: '—', cls: '' };
  summaryEl.innerHTML =
    `<span class="ps-result ${rl.cls}">${rl.text}</span>` +
    `<span class="ps-sep">•</span>` +
    `<span>${tm.steps} paso${tm.steps !== 1 ? 's' : ''} ejecutado${tm.steps !== 1 ? 's' : ''}</span>` +
    `<span class="ps-sep">•</span>` +
    `<span>${path.length} estado${path.length !== 1 ? 's' : ''} distinto${path.length !== 1 ? 's' : ''} visitado${path.length !== 1 ? 's' : ''}</span>`;

  pathSection.classList.add('visible');
}


/* ============================================================
   RENDER — NUEVAS ENTRADAS DEL LOG
   ─────────────────────────────────────────────────────────────
   Añade únicamente las entradas nuevas (desde logRenderedCount)
   sin re-renderizar todo el historial en cada paso.
============================================================ */
function renderNewLogEntries() {
  const log = document.getElementById('step-log');
  const emptyEl = document.getElementById('log-empty');
  const newCount = tm.stepLog.length;

  if (newCount > 0 && emptyEl) emptyEl.remove();

  while (logRenderedCount < newCount) {
    const entry = tm.stepLog[logRenderedCount];

    // Texto de la acción
    let action;
    if (entry.halted) {
      action = { accept: '🏁 ACEPTADA', reject: '🚫 RECHAZADA', timeout: '⏱ TIMEOUT' }[entry.halted] || 'DETENIDA';
    } else if (entry.applied) {
      const mv = { L: '←', R: '→', S: '●' }[entry.applied.move] || entry.applied.move;
      action = `→ (${entry.applied.next}, '${entry.applied.write}', ${mv})`;
    } else {
      action = '✗ Sin transición';
    }

    const div = document.createElement('div');
    div.className =
      'log-entry' +
      (entry.halted === 'accept' ? ' log-accept' : '') +
      (entry.halted === 'reject' ? ' log-reject' : '') +
      (entry.halted === 'timeout' ? ' log-timeout' : '');

    div.innerHTML =
      `<span class="log-step">#${entry.step}</span>` +
      `<span class="log-state">${entry.state}</span>` +
      `<span class="log-head">${entry.head}</span>` +
      `<span class="log-sym">'${entry.sym}'</span>` +
      `<span class="log-action">${action}</span>`;

    log.appendChild(div);
    logRenderedCount++;
  }
  log.scrollTop = log.scrollHeight;
}


/* ============================================================
   RENDER — RESALTAR FILA ACTIVA EN TABLA DE TRANSICIONES
============================================================ */
function highlightActiveRow(key) {
  document.querySelectorAll('#trans-tbody tr').forEach(tr => tr.classList.remove('active-row'));
  if (!key) return;
  document.querySelectorAll('#trans-tbody tr').forEach(tr => {
    const s = tr.querySelector('.t-state')?.value?.trim();
    const r = tr.querySelector('.t-read')?.value?.trim();
    if (s && r && `${s},${r}` === key) tr.classList.add('active-row');
  });
}


/* ============================================================
   RENDER COMPLETO — llama a todas las funciones render
============================================================ */
function renderAll() {
  renderTape();
  renderStatus();
  renderHeadStates();
  renderTransInfo();
  renderResult();
  renderNewLogEntries();
  highlightActiveRow(tm.lastApplied?.key || null);
}


/* ============================================================
   TABLA DE TRANSICIONES — GESTIÓN DE FILAS
============================================================ */
function buildRow(state = '', read = '', next = '', write = '', move = 'R') {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="t-input t-state" value="${state}" placeholder="q0" title="Estado actual"></td>
    <td><input class="t-input t-read"  value="${read}"  placeholder="#"  title="Símbolo leído" style="max-width:80px"></td>
    <td class="td-arrow">→</td>
    <td><input class="t-input t-next"  value="${next}"  placeholder="q1" title="Nuevo estado"></td>
    <td><input class="t-input t-write" value="${write}" placeholder="#"  title="Símbolo a escribir" style="max-width:80px"></td>
    <td>
      <select class="t-select t-move" title="Dirección del movimiento">
        <option value="R" ${move === 'R' ? 'selected' : ''}>R →</option>
        <option value="L" ${move === 'L' ? 'selected' : ''}>L ←</option>
        <option value="S" ${move === 'S' ? 'selected' : ''}>S ●</option>
      </select>
    </td>
    <td><button class="btn-del-row" onclick="this.closest('tr').remove()" title="Eliminar">✕</button></td>
  `;
  return tr;
}

function addTransRow() {
  document.getElementById('trans-tbody').appendChild(buildRow());
}

function loadTransitionsIntoTable(arr) {
  const tbody = document.getElementById('trans-tbody');
  tbody.innerHTML = '';
  arr.forEach(([s, r, n, w, m]) => tbody.appendChild(buildRow(s, r, n, w, m)));
}

function applyTransitions() {
  const arr = [];
  document.querySelectorAll('#trans-tbody tr').forEach(tr => {
    const s = tr.querySelector('.t-state')?.value?.trim();
    const r = tr.querySelector('.t-read')?.value?.trim();
    const n = tr.querySelector('.t-next')?.value?.trim();
    const w = tr.querySelector('.t-write')?.value?.trim();
    const m = tr.querySelector('.t-move')?.value?.trim();
    if (s && r && n && w && m) arr.push([s, r, n, w, m]);
  });
  tm.setTransitions(arr);

  // Feedback visual en el botón
  const btn = document.getElementById('btn-apply-trans');
  btn.textContent = '✓ ¡Aplicadas!';
  setTimeout(() => {
    btn.innerHTML =
      `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2.5" stroke-linecap="round"><polyline points="20,6 9,17 4,12"/></svg>
       Aplicar transiciones`;
  }, 1600);
}


/* ============================================================
   PANEL FLOTANTE — CONTROLES
============================================================ */
function openLogPanel() {
  document.getElementById('float-panel').classList.add('open');
  document.getElementById('fab-log').classList.add('hidden');
}

function closeLogPanel() {
  document.getElementById('float-panel').classList.remove('open');
  document.getElementById('fab-log').classList.remove('hidden');
}

function clearLog() {
  const log = document.getElementById('step-log');
  log.innerHTML = '<div class="log-empty" id="log-empty">— El historial aparecerá aquí al ejecutar la máquina —</div>';
  logRenderedCount = 0;
  tm.stepLog = [];
  document.getElementById('fp-path').classList.remove('visible');
}


/* ============================================================
   PANEL FLOTANTE — DRAG (arrastre con mouse y touch)
   ─────────────────────────────────────────────────────────────
   Al iniciar el arrastre, convertimos el posicionamiento del panel
   de right/bottom (CSS) a left/top (inline) para poder moverlo
   libremente. Al soltar, el panel queda donde el usuario lo dejó.
============================================================ */
(function initDrag() {
  const panel = document.getElementById('float-panel');
  const handle = document.getElementById('fp-drag-handle');
  let active = false;
  let startX, startY, originLeft, originTop;

  function begin(cx, cy) {
    const rect = panel.getBoundingClientRect();
    // Fijar posición como left/top para poder mover libremente
    panel.style.left = rect.left + 'px';
    panel.style.top = rect.top + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    startX = cx; startY = cy;
    originLeft = rect.left; originTop = rect.top;
    active = true;
    panel.style.transition = 'none';  // desactivar transición durante drag
  }

  function move(cx, cy) {
    if (!active) return;
    const nx = Math.max(0, Math.min(window.innerWidth - 80, originLeft + cx - startX));
    const ny = Math.max(0, Math.min(window.innerHeight - 80, originTop + cy - startY));
    panel.style.left = nx + 'px';
    panel.style.top = ny + 'px';
  }

  function end() {
    active = false;
    panel.style.transition = '';  // restaurar transición suave
  }

  // Mouse
  handle.addEventListener('mousedown', e => { begin(e.clientX, e.clientY); e.preventDefault(); });
  document.addEventListener('mousemove', e => move(e.clientX, e.clientY));
  document.addEventListener('mouseup', () => end());

  // Touch (móvil)
  handle.addEventListener('touchstart', e => {
    const t = e.touches[0];
    begin(t.clientX, t.clientY);
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    const t = e.touches[0];
    move(t.clientX, t.clientY);
  }, { passive: true });
  document.addEventListener('touchend', () => end());
})();


/* ============================================================
   ACCIONES DE CONTROL DE LA MT
============================================================ */

/* Ejecuta un solo paso manualmente */
function uiStep() {
  if (tm.halted || isRunning) return;
  tm.step();
  renderAll();
  updateButtons();
}

/* Inicia la ejecución automática */
function uiRun() {
  if (isRunning || tm.halted) return;
  isRunning = true;
  updateButtons();

  const speed = parseInt(document.getElementById('speed-slider').value);
  const delay = Math.max(40, 620 - speed * 58); // 40ms (rápido) → ~580ms (lento)

  runInterval = setInterval(() => {
    if (tm.halted) { uiPause(); return; }
    const result = tm.step();
    renderAll();
    if (result !== 'continue') uiPause();
  }, delay);
}

/* Pausa la ejecución automática */
function uiPause() {
  if (runInterval) { clearInterval(runInterval); runInterval = null; }
  isRunning = false;
  updateButtons();
}

/* Configuración del ejemplo actualmente cargado (para poder reiniciarlo correctamente) */
let currentExample = null;

/* Reinicia la MT con la configuración del ejemplo actualmente cargado */
function uiReset() {
  uiPause();

  // Si hay un ejemplo guardado, restaurar sus valores iniciales en los campos
  if (currentExample) {
    document.getElementById('tape-input').value = currentExample.input;
    document.getElementById('head-input').value = currentExample.head;
    document.getElementById('state-input').value = currentExample.startState;
    document.getElementById('accept-input').value = currentExample.acceptState;
    document.getElementById('reject-input').value = currentExample.rejectState;
  }

  const input = document.getElementById('tape-input').value || '#';
  const head = parseInt(document.getElementById('head-input').value) || 0;
  const startState = document.getElementById('state-input').value.trim() || 'q0';
  const acceptState = document.getElementById('accept-input').value.trim() || 'q_accept';
  const rejectState = document.getElementById('reject-input').value.trim() || 'q_reject';

  tm.acceptState = acceptState;
  tm.rejectState = rejectState;
  tm.loadTape(input, head, startState);
  prevHead = head; // Restablecer puntero de cabezal previo

  // Limpiar log del DOM
  const log = document.getElementById('step-log');
  log.innerHTML = '<div class="log-empty" id="log-empty">— El historial aparecerá aquí al ejecutar la máquina —</div>';
  logRenderedCount = 0;

  // Limpiar elementos de UI
  document.getElementById('result-banner').className = '';
  document.getElementById('trans-info').className = 'trans-info-box no-trans';
  document.getElementById('trans-info').textContent = 'Sin transición aplicada aún — presiona «Paso a paso» para comenzar';
  document.getElementById('fp-path').classList.remove('visible');
  document.querySelectorAll('#trans-tbody tr').forEach(tr => tr.classList.remove('active-row'));

  renderTape();
  renderStatus();
  renderHeadStates();
  updateButtons();
}

/* Aplica la nueva cinta escrita por el usuario, manteniendo las transiciones del ejemplo */
function uiApplyConfig() {
  const newInput = document.getElementById('tape-input').value || '#';
  const newHead  = parseInt(document.getElementById('head-input').value) || 0;

  // Actualizar el snapshot del ejemplo con la nueva cinta/posición
  if (currentExample) {
    currentExample.input = newInput;
    currentExample.head  = newHead;
  }

  uiReset();
}

/* Busca la definición del ejemplo en predefinidos o en localStorage */
function getExampleData(name) {
  return EXAMPLES[name] || null;
}

/* Carga un ejemplo completo (transiciones + cinta + configuración) */
function loadExample(name) {
  uiPause();
  const ex = getExampleData(name);
  if (!ex) return;

  const startState = ex.startState || 'q0';
  const acceptState = ex.acceptState || 'q_accept';
  const rejectState = ex.rejectState || 'q_reject';

  // Guardar la configuración inicial del ejemplo para poder reiniciarla después
  currentExample = {
    input: ex.input,
    head: ex.head,
    startState: startState,
    acceptState: acceptState,
    rejectState: rejectState,
    transitions: ex.transitions
  };

  document.getElementById('tape-input').value = ex.input;
  document.getElementById('head-input').value = ex.head;
  document.getElementById('state-input').value = startState;
  document.getElementById('accept-input').value = acceptState;
  document.getElementById('reject-input').value = rejectState;

  loadTransitionsIntoTable(ex.transitions);
  tm.setTransitions(ex.transitions);
  tm.acceptState = acceptState;
  tm.rejectState = rejectState;
  tm.loadTape(ex.input, ex.head, startState);
  prevHead = ex.head;

  // Descripción del ejemplo
  const desc = document.getElementById('example-desc');
  desc.textContent = ex.description;
  desc.classList.add('visible');

  // Marcar botón activo
  document.querySelectorAll('.btn-ex').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`ex-${name}`);
  if (btn) btn.classList.add('active');

  // Limpiar UI
  const log = document.getElementById('step-log');
  log.innerHTML = '<div class="log-empty" id="log-empty">— El historial aparecerá aquí al ejecutar la máquina —</div>';
  logRenderedCount = 0;

  document.getElementById('result-banner').className = '';
  document.getElementById('trans-info').className = 'trans-info-box no-trans';
  document.getElementById('trans-info').textContent = 'Sin transición aplicada aún — presiona «Paso a paso» para comenzar';
  document.getElementById('fp-path').classList.remove('visible');
  document.querySelectorAll('#trans-tbody tr').forEach(tr => tr.classList.remove('active-row'));

  renderTape();
  renderStatus();
  renderHeadStates();
  updateButtons();
}

/* Genera la lista de botones de ejemplos predefinidos */
function renderExamplesList() {
  const container = document.getElementById('examples-container');
  if (!container) return;
  // Los botones ya están en el HTML, no es necesario regenerarlos.
  // Esta función existe para compatibilidad.
}

/* ── ELIMINADO: saveCustomExample, deleteCustomExample, exportConfigToJson, importConfigFromJson ── */
// Estas funciones han sido removidas según solicitud del usuario.

function _REMOVED_saveCustomExample() {
  const label = prompt("Introduce un nombre descriptivo para tu ejemplo:");
  if (!label || !label.trim()) return;

  const transitions = [];
  document.querySelectorAll('#trans-tbody tr').forEach(tr => {
    const s = tr.querySelector('.t-state')?.value?.trim();
    const r = tr.querySelector('.t-read')?.value?.trim();
    const n = tr.querySelector('.t-next')?.value?.trim();
    const w = tr.querySelector('.t-write')?.value?.trim();
    const m = tr.querySelector('.t-move')?.value?.trim();
    if (s && r && n && w && m) transitions.push([s, r, n, w, m]);
  });

  const ex = {
    label: label.trim(),
    input: document.getElementById('tape-input').value,
    head: parseInt(document.getElementById('head-input').value) || 0,
    startState: document.getElementById('state-input').value.trim() || 'q0',
    acceptState: document.getElementById('accept-input').value.trim() || 'q_accept',
    rejectState: document.getElementById('reject-input').value.trim() || 'q_reject',
    transitions: transitions,
    description: `👤 Ejemplo Personalizado: "${label.trim()}" guardado en el navegador.`
  };

  let custom = {};
  try {
    custom = JSON.parse(localStorage.getItem('turing_custom_examples') || '{}');
  } catch (e) { }

  const key = 'custom_' + Date.now();
  custom[key] = ex;
  localStorage.setItem('turing_custom_examples', JSON.stringify(custom));

  renderExamplesList();
  loadExample(key);
}

function _REMOVED_deleteCustomExample(key) {
  if (!confirm("¿Deseas eliminar este ejemplo personalizado permanentemente?")) return;
  let custom = {};
  try {
    custom = JSON.parse(localStorage.getItem('turing_custom_examples') || '{}');
  } catch (e) { }

  delete custom[key];
  localStorage.setItem('turing_custom_examples', JSON.stringify(custom));

  renderExamplesList();

  // Si el eliminado estaba activo, cargar el primero predefinido
  const activeBtn = document.getElementById(`ex-${key}`);
  if (!activeBtn || activeBtn.classList.contains('active')) {
    loadExample('unary_add');
  }
}

/* Genera la lista completa de botones de ejemplos (predefinidos + personalizados) */
function renderExamplesList() {
  const container = document.getElementById('examples-container');
  container.innerHTML = '';

  // 1. Agregar los predefinidos
  Object.keys(EXAMPLES).forEach(key => {
    const ex = EXAMPLES[key];
    const btn = document.createElement('button');
    btn.className = 'btn-ex';
    btn.id = `ex-${key}`;
    btn.onclick = () => loadExample(key);
    btn.textContent = ex.label;
    container.appendChild(btn);
  });

  // 2. Agregar los personalizados
  let custom = {};
  try {
    custom = JSON.parse(localStorage.getItem('turing_custom_examples') || '{}');
  } catch (e) { }

  Object.keys(custom).forEach(key => {
    const ex = custom[key];
    const btn = document.createElement('button');
    btn.className = 'btn-ex';
    btn.id = `ex-${key}`;

    // Al hacer clic, cargar a menos que se pulse la cruz de eliminar
    btn.onclick = (e) => {
      if (e.target.classList.contains('btn-ex-del')) {
        e.stopPropagation();
        deleteCustomExample(key);
      } else {
        loadExample(key);
      }
    };

    const labelSpan = document.createElement('span');
    labelSpan.textContent = `👤 ${ex.label}`;
    btn.appendChild(labelSpan);

    const delSpan = document.createElement('span');
    delSpan.className = 'btn-ex-del';
    delSpan.textContent = '✕';
    delSpan.title = 'Eliminar ejemplo';
    btn.appendChild(delSpan);

    container.appendChild(btn);
  });
}

function _REMOVED_exportConfigToJson() {
  const transitions = [];
  document.querySelectorAll('#trans-tbody tr').forEach(tr => {
    const s = tr.querySelector('.t-state')?.value?.trim();
    const r = tr.querySelector('.t-read')?.value?.trim();
    const n = tr.querySelector('.t-next')?.value?.trim();
    const w = tr.querySelector('.t-write')?.value?.trim();
    const m = tr.querySelector('.t-move')?.value?.trim();
    if (s && r && n && w && m) transitions.push([s, r, n, w, m]);
  });

  const data = {
    label: 'Configuración de Máquina de Turing',
    input: document.getElementById('tape-input').value,
    head: parseInt(document.getElementById('head-input').value) || 0,
    startState: document.getElementById('state-input').value.trim() || 'q0',
    acceptState: document.getElementById('accept-input').value.trim() || 'q_accept',
    rejectState: document.getElementById('reject-input').value.trim() || 'q_reject',
    transitions: transitions,
    description: 'Configuración importada desde archivo JSON.'
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `maquina-turing-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function _REMOVED_importConfigFromJson(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const ex = JSON.parse(e.target.result);
      if (!ex.transitions || !Array.isArray(ex.transitions)) {
        alert("El archivo JSON no tiene un formato válido para la máquina de Turing.");
        return;
      }

      document.getElementById('tape-input').value = ex.input || '';
      document.getElementById('head-input').value = ex.head || 0;
      document.getElementById('state-input').value = ex.startState || 'q0';
      document.getElementById('accept-input').value = ex.acceptState || 'q_accept';
      document.getElementById('reject-input').value = ex.rejectState || 'q_reject';

      loadTransitionsIntoTable(ex.transitions);
      tm.setTransitions(ex.transitions);
      tm.acceptState = ex.acceptState || 'q_accept';
      tm.rejectState = ex.rejectState || 'q_reject';
      tm.loadTape(ex.input || '', ex.head || 0, ex.startState || 'q0');
      prevHead = ex.head || 0;

      const desc = document.getElementById('example-desc');
      desc.textContent = ex.description || 'Configuración cargada desde JSON.';
      desc.classList.add('visible');

      document.querySelectorAll('.btn-ex').forEach(b => b.classList.remove('active'));

      uiReset();
      alert("¡Configuración cargada exitosamente!");
    } catch (err) {
      alert("Error al cargar el archivo JSON: " + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = ''; // Limpiar input file
}

/* Actualiza el estado habilitado/deshabilitado de los botones */
function updateButtons() {
  document.getElementById('btn-step').disabled = tm.halted || isRunning;
  document.getElementById('btn-run').disabled = tm.halted || isRunning;
  document.getElementById('btn-pause').disabled = !isRunning;
}


/* ============================================================
   EVENTOS DE LA INTERFAZ
============================================================ */

// Control de velocidad — ajusta el intervalo si está en ejecución
document.getElementById('speed-slider').addEventListener('input', function () {
  document.getElementById('speed-val').textContent = this.value;
  if (isRunning) { uiPause(); uiRun(); }
});

// Control de zoom de la cinta
document.getElementById('zoom-slider').addEventListener('input', function () {
  const val = this.value;
  document.getElementById('zoom-val').textContent = `${val}px`;
  document.documentElement.style.setProperty('--cell-width', `${val}px`);
  renderTape();
});



// Escuchar cambios en la tabla de transiciones para aplicar automáticamente
document.getElementById('trans-tbody').addEventListener('input', () => {
  const arr = [];
  document.querySelectorAll('#trans-tbody tr').forEach(tr => {
    const s = tr.querySelector('.t-state')?.value?.trim();
    const r = tr.querySelector('.t-read')?.value?.trim();
    const n = tr.querySelector('.t-next')?.value?.trim();
    const w = tr.querySelector('.t-write')?.value?.trim();
    const m = tr.querySelector('.t-move')?.value?.trim();
    if (s && r && n && w && m) arr.push([s, r, n, w, m]);
  });
  tm.setTransitions(arr);
  renderTape(); // Actualizar semáforo de próximo paso
});

// Enter en los campos de texto aplica la configuración
document.getElementById('tape-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') uiApplyConfig();
});
document.getElementById('head-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') uiApplyConfig();
});


/* ============================================================
   INICIALIZACIÓN
   Carga el ejemplo de suma unaria al iniciar.
============================================================ */
loadExample('unary_add');
