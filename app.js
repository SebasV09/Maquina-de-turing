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
   UTILIDADES — ALFABETO Y ENTRADA
============================================================ */
const BLANK_SYM = '#';
const RESERVED_MARKERS = ['X', '\u2297', '\u25A1', '\u25FB'];

/** Símbolos únicos de la cinta (sin blanco ni separadores opcionales). */
function uniqueTapeSymbols(str, exclude = []) {
  const skip = new Set([BLANK_SYM, ...exclude]);
  const seen = new Set();
  const out = [];
  for (const ch of str) {
    if (skip.has(ch) || seen.has(ch)) continue;
    seen.add(ch);
    out.push(ch);
  }
  return out;
}

/** Elimina '#' de la entrada del usuario (reservado para celda vacía). */
function sanitizeTapeInput(str) {
  return (str || '').split('').filter(ch => ch !== BLANK_SYM).join('');
}

/** Elige un marcador auxiliar que no aparezca en la cinta ni sea blanco. */
function pickAuxMarker(forbidden) {
  const ban = new Set([BLANK_SYM, ...forbidden]);
  for (const m of RESERVED_MARKERS) {
    if (!ban.has(m)) return m;
  }
  for (let c = 65; c < 127; c++) {
    const m = String.fromCharCode(c);
    if (!ban.has(m)) return m;
  }
  return 'X';
}

/** ¿Todos los caracteres de `str` están en `allowed`? */
function onlyUsesAlphabet(str, allowed) {
  const set = new Set(allowed);
  for (const ch of str) {
    if (!set.has(ch)) return false;
  }
  return str.length > 0;
}

/* ============================================================
   GENERADORES DE TRANSICIONES (alfabeto parametrizable)
============================================================ */

function generateUnaryAddTransitions(countSymbol, separator = '+') {
  return [
    ['q0', countSymbol, 'q0', countSymbol, 'R'],
    ['q0', separator, 'q1', countSymbol, 'R'],
    ['q1', countSymbol, 'q1', countSymbol, 'R'],
    ['q1', BLANK_SYM, 'q2', BLANK_SYM, 'L'],
    ['q2', countSymbol, 'q_accept', BLANK_SYM, 'S'],
  ];
}

function generateEvenOnesTransitions(countSymbol, passSymbols) {
  const trans = [];
  for (const s of passSymbols) {
    trans.push(['q0', s, 'q0', s, 'R']);
    trans.push(['q1', s, 'q1', s, 'R']);
  }
  trans.push(['q0', countSymbol, 'q1', countSymbol, 'R']);
  trans.push(['q0', BLANK_SYM, 'q_accept', BLANK_SYM, 'S']);
  trans.push(['q1', countSymbol, 'q0', countSymbol, 'R']);
  trans.push(['q1', BLANK_SYM, 'q_reject', BLANK_SYM, 'S']);
  return trans;
}

function generatePalindromeTransitions(alphabet) {
  const syms = alphabet.length ? alphabet : ['a', 'b'];
  const n = syms.length;
  const qReturn = `q${2 * n + 1}`;
  const trans = [['q0', BLANK_SYM, 'q_accept', BLANK_SYM, 'S']];

  for (let i = 0; i < n; i++) {
    const qScan = `q${i + 1}`;
    const qCheck = `q${n + 1 + i}`;
    trans.push(['q0', syms[i], qScan, BLANK_SYM, 'R']);
    for (const s of syms) trans.push([qScan, s, qScan, s, 'R']);
    trans.push([qScan, BLANK_SYM, qCheck, BLANK_SYM, 'L']);
    for (let j = 0; j < n; j++) {
      if (j === i) trans.push([qCheck, syms[j], qReturn, BLANK_SYM, 'L']);
      else trans.push([qCheck, syms[j], 'q_reject', syms[j], 'S']);
    }
    trans.push([qCheck, BLANK_SYM, 'q_accept', BLANK_SYM, 'S']);
  }
  for (const s of syms) trans.push([qReturn, s, qReturn, s, 'L']);
  trans.push([qReturn, BLANK_SYM, 'q0', BLANK_SYM, 'R']);
  return trans;
}

function generateBaseIncrementTransitions(digits) {
  const ordered = digits.length ? digits : ['0', '1'];
  const dMin = ordered[0];
  const dMax = ordered[ordered.length - 1];
  const overflowLead = ordered.length > 1 ? ordered[1] : ordered[0];
  const trans = [];
  for (const d of ordered) trans.push(['q0', d, 'q0', d, 'R']);
  trans.push(['q0', BLANK_SYM, 'q1', BLANK_SYM, 'L']);
  trans.push(['q1', dMax, 'q1', dMin, 'L']);
  for (let i = 0; i < ordered.length - 1; i++) {
    trans.push(['q1', ordered[i], 'q_accept', ordered[i + 1], 'S']);
  }
  trans.push(['q1', BLANK_SYM, 'q_accept', overflowLead, 'S']);
  return trans;
}

function generateParenthesesTransitions(openSym, closeSym, marker) {
  return [
    ['q0', openSym, 'q0', openSym, 'R'],
    ['q0', marker, 'q0', marker, 'R'],
    ['q0', closeSym, 'q1', marker, 'L'],
    ['q0', BLANK_SYM, 'q2', BLANK_SYM, 'L'],
    ['q1', marker, 'q1', marker, 'L'],
    ['q1', openSym, 'q0', marker, 'R'],
    ['q1', BLANK_SYM, 'q_reject', BLANK_SYM, 'S'],
    ['q2', marker, 'q2', marker, 'L'],
    ['q2', BLANK_SYM, 'q_accept', BLANK_SYM, 'S'],
    ['q2', openSym, 'q_reject', openSym, 'S'],
  ];
}

/* Parámetros por ejemplo (auto-detección + prompts opcionales) */
function detectUnaryAddParams(input, interactive) {
  const sepIdx = input.indexOf('+');
  if (sepIdx > 0) {
    const left = input.slice(0, sepIdx);
    const countSymbol = left[0];
    if (left.split('').every(ch => ch === countSymbol)) {
      return { countSymbol, separator: '+' };
    }
  }
  const syms = uniqueTapeSymbols(input, ['+']);
  if (syms.length === 1) return { countSymbol: syms[0], separator: '+' };
  if (interactive) {
    const picked = prompt(
      'Suma unaria: símbolo de conteo (ej. 1 o a):',
      syms[0] || '1'
    );
    if (picked && picked.length === 1 && picked !== BLANK_SYM) {
      return { countSymbol: picked, separator: '+' };
    }
  }
  return { countSymbol: '1', separator: '+' };
}

function detectEvenOnesParams(input, interactive) {
  const syms = uniqueTapeSymbols(input);
  if (onlyUsesAlphabet(input, ['0', '1'])) {
    return { countSymbol: '1', passSymbols: ['0'] };
  }
  if (syms.length === 1) {
    return { countSymbol: syms[0], passSymbols: [] };
  }
  if (interactive) {
    const picked = prompt(
      'Par de unos: ¿qué símbolo contar (paridad)?',
      syms[0] || '1'
    );
    if (picked && picked.length === 1 && picked !== BLANK_SYM) {
      return { countSymbol: picked, passSymbols: syms.filter(s => s !== picked) };
    }
  }
  if (syms.length >= 2) {
    const counts = {};
    for (const ch of input) {
      if (syms.includes(ch)) counts[ch] = (counts[ch] || 0) + 1;
    }
    let countSymbol = syms[0];
    let maxN = -1;
    for (const s of syms) {
      if (counts[s] > maxN) { maxN = counts[s]; countSymbol = s; }
    }
    return { countSymbol, passSymbols: syms.filter(s => s !== countSymbol) };
  }
  return { countSymbol: '1', passSymbols: ['0'] };
}

function detectPalindromeParams(input) {
  const alphabet = uniqueTapeSymbols(input);
  return { alphabet: alphabet.length ? alphabet : ['a', 'b'] };
}

function detectBaseIncrementParams(input) {
  if (onlyUsesAlphabet(input, ['0', '1'])) return { digits: ['0', '1'] };
  if (onlyUsesAlphabet(input, '0123456789'.split(''))) {
    return { digits: '0123456789'.split('') };
  }
  const fromTape = uniqueTapeSymbols(input);
  if (fromTape.length) {
    const sorted = fromTape.slice().sort();
    return { digits: sorted };
  }
  return { digits: ['0', '1'] };
}

function detectParenthesesParams(input, interactive) {
  if (input.includes('(') && input.includes(')')) {
    return { openSym: '(', closeSym: ')' };
  }
  const syms = uniqueTapeSymbols(input);
  if (syms.length === 2) {
    return { openSym: syms[0], closeSym: syms[1] };
  }
  if (interactive) {
    const openSym = prompt('Paréntesis: símbolo de apertura:', syms[0] || '(');
    const closeSym = prompt('Paréntesis: símbolo de cierre:', syms[1] || ')');
    if (openSym?.length === 1 && closeSym?.length === 1 &&
        openSym !== BLANK_SYM && closeSym !== BLANK_SYM) {
      return { openSym, closeSym };
    }
  }
  return { openSym: '(', closeSym: ')' };
}

function resolveExampleTransitions(ex, input, interactive) {
  const tape = sanitizeTapeInput(input);
  if (!ex.generateTransitions) {
    return { transitions: ex.transitions, params: null, tape };
  }
  let params;
  switch (ex.id) {
    case 'unary_add':
      params = detectUnaryAddParams(tape, interactive);
      return {
        tape,
        params,
        transitions: ex.generateTransitions(params)
      };
    case 'even_ones':
      params = detectEvenOnesParams(tape, interactive);
      return {
        tape,
        params,
        transitions: ex.generateTransitions(params)
      };
    case 'palindrome':
      params = detectPalindromeParams(tape);
      return {
        tape,
        params,
        transitions: ex.generateTransitions(params)
      };
    case 'binary_increment':
      params = detectBaseIncrementParams(tape);
      return {
        tape,
        params,
        transitions: ex.generateTransitions(params)
      };
    case 'parentheses_match': {
      params = detectParenthesesParams(tape, interactive);
      const marker = pickAuxMarker([params.openSym, params.closeSym, ...uniqueTapeSymbols(tape)]);
      params.marker = marker;
      return {
        tape,
        params,
        transitions: ex.generateTransitions({ ...params, marker })
      };
    }
    default:
      return { transitions: ex.transitions, params: null, tape };
  }
}

/* ============================================================
   EJEMPLOS PRECARGADOS
   ─────────────────────────────────────────────────────────────
   Cada entrada incluye generateTransitions(…) para alfabetos arbitrarios.
   Las transiciones estáticas por defecto preservan el comportamiento original.
============================================================ */
const EXAMPLES = {

  /* ─── Suma Unaria ─── */
  unary_add: {
    id: 'unary_add',
    label: 'Suma Unaria',
    input: '111+11',
    head: 0,
    startState: 'q0',
    acceptState: 'q_accept',
    rejectState: 'q_reject',
    generateTransitions({ countSymbol, separator }) {
      return generateUnaryAddTransitions(countSymbol, separator || '+');
    },
    transitions: generateUnaryAddTransitions('1', '+'),
    description:
      '➕  Suma dos números en notación UNARIA separados por "+".\n' +
      '   El símbolo de conteo se detecta de la cinta (p. ej. "aa+aaa" usa "a").\n' +
      '   Estrategia: convierte "+" en un conteo extra y borra el último símbolo para compensar.\n' +
      '   Entrada: 111+11  →  Salida: 11111  ·  Prueba: "aa+aaa", "1+1111".'
  },

  /* ─── Par de Unos ─── */
  even_ones: {
    id: 'even_ones',
    label: 'Par de Unos',
    input: '10110',
    head: 0,
    startState: 'q0',
    acceptState: 'q_accept',
    rejectState: 'q_reject',
    generateTransitions({ countSymbol, passSymbols }) {
      return generateEvenOnesTransitions(countSymbol, passSymbols || []);
    },
    transitions: generateEvenOnesTransitions('1', ['0']),
    description:
      '🔢  Acepta cadenas con número PAR de un símbolo elegido.\n' +
      '   Por defecto cuenta "1" e ignora "0"; con "xxyxx" cuenta "x".\n' +
      '   q0 = paridad par  •  q1 = paridad impar (AFD de 2 estados).\n' +
      'Prueba: "1010" (✓)  •  "xxyxx" (3×x → ✗)  •  "1111" (✓).'
  },

  /* ─── Palíndromos (alfabeto detectado en la cinta) ─── */
  palindrome: {
    id: 'palindrome',
    label: 'Palíndromo',
    input: 'abba',
    head: 0,
    startState: 'q0',
    acceptState: 'q_accept',
    rejectState: 'q_reject',
    generateTransitions({ alphabet }) {
      return generatePalindromeTransitions(alphabet);
    },
    transitions: generatePalindromeTransitions(['a', 'b']),
    description:
      '🔄  Reconoce palíndromos sobre el alfabeto de la cinta.\n' +
      '   Borra extremos opuestos y compara; genera δ para cada símbolo detectado.\n' +
      'Prueba: "abba" · "1001" · "ABBA" · "xyzzyx" · "12321".'
  },

  /* ─── Incremento en base detectada ─── */
  binary_increment: {
    id: 'binary_increment',
    label: 'Incremento (+1)',
    input: '1011',
    head: 0,
    startState: 'q0',
    acceptState: 'q_accept',
    rejectState: 'q_reject',
    generateTransitions({ digits }) {
      return generateBaseIncrementTransitions(digits);
    },
    transitions: generateBaseIncrementTransitions(['0', '1']),
    description:
      '🔢  Suma 1 al número en la cinta (binario, decimal u otro alfabeto ordenado).\n' +
      '   Detecta dígitos: {0,1} → binario; solo 0-9 → decimal; si no, símbolos únicos ordenados.\n' +
      '   Entrada: 1011 → 1100  ·  "123" → "124".'
  },

  /* ─── Validador de pares apertura/cierre ─── */
  parentheses_match: {
    id: 'parentheses_match',
    label: 'Validador de Paréntesis',
    input: '(()())',
    head: 0,
    startState: 'q0',
    acceptState: 'q_accept',
    rejectState: 'q_reject',
    generateTransitions({ openSym, closeSym, marker }) {
      return generateParenthesesTransitions(openSym, closeSym, marker || 'X');
    },
    transitions: generateParenthesesTransitions('(', ')', 'X'),
    description:
      '()  Verifica balance de un par apertura/cierre (por defecto "(" y ")").\n' +
      '   Con otros símbolos se detectan o se preguntan al cargar; usa marcador auxiliar fuera del alfabeto.\n' +
      '   Prueba: "(()())" (✓) · "<><>" con < y > · "(()" (✗).'
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
let currentExampleKey = null;

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

  const input = sanitizeTapeInput(document.getElementById('tape-input').value);
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

/* Aplica la nueva cinta escrita por el usuario, regenerando δ si el ejemplo es parametrizable */
function uiApplyConfig() {
  const rawInput = document.getElementById('tape-input').value || '';
  const newInput = sanitizeTapeInput(rawInput);
  const newHead = parseInt(document.getElementById('head-input').value) || 0;

  if (rawInput !== newInput) {
    document.getElementById('tape-input').value = newInput;
    showTapeInputHint('El símbolo # está reservado para celdas vacías y se eliminó de la cinta.');
  }

  if (currentExampleKey) {
    const ex = getExampleData(currentExampleKey);
    if (ex?.generateTransitions) {
      const { transitions, tape, params } = resolveExampleTransitions(ex, newInput, false);
      currentExample = {
        ...currentExample,
        input: tape,
        head: newHead,
        transitions,
        params
      };
      document.getElementById('tape-input').value = tape;
      loadTransitionsIntoTable(transitions);
      tm.setTransitions(transitions);
    } else if (currentExample) {
      currentExample.input = newInput;
      currentExample.head = newHead;
    }
  } else if (currentExample) {
    currentExample.input = newInput;
    currentExample.head = newHead;
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

  currentExampleKey = name;
  const startState = ex.startState || 'q0';
  const acceptState = ex.acceptState || 'q_accept';
  const rejectState = ex.rejectState || 'q_reject';

  const baseInput = sanitizeTapeInput(ex.input);
  const { transitions, tape, params } = resolveExampleTransitions(ex, baseInput, true);

  currentExample = {
    input: tape,
    head: ex.head,
    startState: startState,
    acceptState: acceptState,
    rejectState: rejectState,
    transitions: transitions,
    params: params
  };

  document.getElementById('tape-input').value = tape;
  document.getElementById('head-input').value = ex.head;
  document.getElementById('state-input').value = startState;
  document.getElementById('accept-input').value = acceptState;
  document.getElementById('reject-input').value = rejectState;

  loadTransitionsIntoTable(transitions);
  tm.setTransitions(transitions);
  tm.acceptState = acceptState;
  tm.rejectState = rejectState;
  tm.loadTape(tape, ex.head, startState);
  prevHead = ex.head;
  clearTapeInputHint();

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
   VALIDACIÓN DE ENTRADA DE CINTA
============================================================ */
function showTapeInputHint(msg) {
  const el = document.getElementById('tape-input-hint');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
}

function clearTapeInputHint() {
  const el = document.getElementById('tape-input-hint');
  if (!el) return;
  el.textContent = '';
  el.classList.remove('visible');
}

function onTapeInputChange() {
  const input = document.getElementById('tape-input');
  if (!input) return;
  const raw = input.value;
  if (raw.indexOf(BLANK_SYM) === -1) {
    clearTapeInputHint();
    return;
  }
  const cleaned = sanitizeTapeInput(raw);
  input.value = cleaned;
  showTapeInputHint('No uses "#" en la cinta: es el símbolo blanco de la MT.');
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

// Validar cinta: '#' reservado para blanco
document.getElementById('tape-input').addEventListener('input', onTapeInputChange);
document.getElementById('tape-input').addEventListener('blur', onTapeInputChange);

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
