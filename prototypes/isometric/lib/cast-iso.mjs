// Isometric-cast parameter table — one entry per office character, transcribed
// 1:1 from the top-down recipes in src/renderer/src/scene/office/portraitArt.ts
// (RECIPES / IMAJU_RECIPES) so an iso sprite carries the same identity
// (skin / hair color / clothing accent / hairstyle silhouette) as its card.
//
// skin categories map to portraitArt.ts's SKIN[cat].base:
export const SKIN_BASE = {
  light: [247, 201, 170],
  tan:   [214, 162, 116],
  brown: [158, 112, 78],
  dark:  [120, 80, 56],
};

// department -> accent (design/tokens.ts) used to tint each room floor/wall.
export const ACCENT = {
  coral: [0xd9, 0x6a, 0x62], mint: [0x5c, 0xa9, 0x7a], sky: [0x4f, 0x9f, 0xaf],
  lemon: [0xdc, 0xab, 0x3c], lilac: [0x94, 0x82, 0xd3], peach: [0xd9, 0x91, 0x68],
};
export const DEPARTMENT_ACCENT = {
  'Dirección': 'coral', 'Desarrollo': 'sky', 'Creativo': 'lilac', 'Marketing': 'peach',
  'Finanzas': 'mint', 'Redacción': 'lemon', 'Ciberseguridad': 'coral',
};
export const DEPARTMENTS = ['Dirección', 'Desarrollo', 'Creativo', 'Marketing', 'Finanzas', 'Redacción', 'Ciberseguridad'];

// c = clothing accent (c1), hairc = hair color, hair = silhouette key.
// fem/heavy/glasses/facial mirror the portrait recipe flags.
export const CAST = {
  // ── IMAJU cast ──────────────────────────────────────────────────────────
  sofia:     { display: 'Sofía',     skin: 'light', hairc: [140, 70, 50],   hair: 'frame',  hlen: 19, c: [60, 150, 150],  fem: true },
  mateo:     { display: 'Mateo',     skin: 'tan',   hairc: [30, 24, 20],    hair: 'short',  part: 'L', c: [50, 70, 110],  tie: [30, 45, 80] },
  valentina: { display: 'Valentina', skin: 'brown', hairc: [20, 16, 14],    hair: 'curly',  c: [120, 40, 55],   fem: true },
  diego:     { display: 'Diego',     skin: 'dark',  hairc: [35, 28, 22],    hair: 'spiky',  c: [50, 120, 70] },
  camila:    { display: 'Camila',    skin: 'tan',   hairc: [200, 160, 60],  hair: 'bun',    c: [220, 110, 90],  fem: true },
  lucas:     { display: 'Lucas',     skin: 'light', hairc: [180, 140, 80],  hair: 'messy',  hlen: 9,  c: [190, 150, 40] },
  elena:     { display: 'Elena',     skin: 'dark',  hairc: [20, 16, 14],    hair: 'frame',  hlen: 20, c: [40, 150, 160], fem: true },
  andres:    { display: 'Andrés',    skin: 'brown', hairc: [150, 150, 150], hair: 'recede', c: [110, 110, 120], tie: [70, 70, 85], glasses: true },
  mariana:   { display: 'Mariana',   skin: 'light', hairc: [110, 50, 40],   hair: 'curly',  c: [170, 140, 190], fem: true },
  javier:    { display: 'Javier',    skin: 'tan',   hairc: [35, 28, 22],    hair: 'short',  part: 'R', c: [50, 50, 58],  tie: [120, 40, 40], glasses: true, suit: true },
  isabella:  { display: 'Isabella',  skin: 'brown', hairc: [15, 12, 12],    hair: 'bun',    c: [200, 160, 50],  fem: true },
  carlos:    { display: 'Carlos',    skin: 'dark',  hairc: [25, 20, 18],    hair: 'bald',   c: [40, 60, 110] },
  gabriela:  { display: 'Gabriela',  skin: 'tan',   hairc: [110, 65, 40],   hair: 'floppy', c: [220, 130, 150], fem: true },
  rafael:    { display: 'Rafael',    skin: 'light', hairc: [30, 24, 20],    hair: 'frame',  hlen: 14, c: [45, 55, 80],  tie: [150, 40, 40], suit: true },
  daniela:   { display: 'Daniela',   skin: 'dark',  hairc: [20, 16, 14],    hair: 'messy',  hlen: 10, c: [60, 160, 170], fem: true },
  tomas:     { display: 'Tomás',     skin: 'brown', hairc: [195, 155, 70],  hair: 'spiky',  c: [180, 50, 50] },
  paula:     { display: 'Paula',     skin: 'light', hairc: [210, 180, 90],  hair: 'short',  part: 'L', c: [120, 190, 160], fem: true },
  nicolas:   { display: 'Nicolás',   skin: 'tan',   hairc: [20, 16, 14],    hair: 'curly',  c: [40, 90, 55],    facial: 'stubble' },
  renata:    { display: 'Renata',    skin: 'brown', hairc: [120, 116, 122], hair: 'bun',    c: [110, 60, 100],  fem: true },
  emilio:    { display: 'Emilio',    skin: 'dark',  hairc: [20, 16, 14],    hair: 'recede', c: [90, 100, 55],   facial: 'goatee' },
  // ── The Office cast (munder-difflin's own GOD / manually-hired agents) ────
  michael:   { display: 'Michael',   skin: 'light', hairc: [58, 42, 28],    hair: 'short',  part: 'L', c: [58, 63, 74],   tie: [170, 58, 58], suit: true },
  jim:       { display: 'Jim',       skin: 'light', hairc: [92, 60, 34],    hair: 'floppy', c: [172, 196, 224], tie: [120, 130, 150] },
  pam:       { display: 'Pam',       skin: 'light', hairc: [120, 76, 42],   hair: 'frame',  hlen: 18, c: [236, 174, 192], fem: true },
  dwight:    { display: 'Dwight',    skin: 'light', hairc: [64, 48, 28],    hair: 'short',  part: 'L', recede: true, c: [184, 155, 62], tie: [120, 82, 46], glasses: true },
  kevin:     { display: 'Kevin',     skin: 'light', hairc: [58, 44, 30],    hair: 'bald',   c: [110, 140, 180], heavy: true },
  angela:    { display: 'Angela',    skin: 'light', hairc: [186, 154, 90],  hair: 'bun',    c: [150, 146, 170], fem: true },
  oscar:     { display: 'Oscar',     skin: 'tan',   hairc: [28, 22, 18],    hair: 'short',  part: 'L', c: [122, 60, 74] },
  stanley:   { display: 'Stanley',   skin: 'dark',  hairc: [60, 54, 48],    hair: 'recede', c: [150, 120, 86], tie: [120, 78, 52], glasses: true, facial: 'mustache', heavy: true },
  phyllis:   { display: 'Phyllis',   skin: 'light', hairc: [196, 162, 110], hair: 'curly',  c: [202, 160, 192], glasses: true, fem: true, heavy: true },
  andy:      { display: 'Andy',      skin: 'light', hairc: [74, 51, 32],    hair: 'short',  part: 'R', c: [176, 65, 58] },
  kelly:     { display: 'Kelly',     skin: 'tan',   hairc: [24, 18, 22],    hair: 'frame',  hlen: 20, c: [212, 90, 158], fem: true },
  ryan:      { display: 'Ryan',      skin: 'light', hairc: [42, 32, 24],    hair: 'spiky',  c: [58, 58, 68], tie: [40, 40, 50], suit: true },
  toby:      { display: 'Toby',      skin: 'light', hairc: [106, 90, 66],   hair: 'short',  part: 'L', recede: true, c: [150, 150, 120], facial: 'mustache' },
  creed:     { display: 'Creed',     skin: 'light', hairc: [170, 166, 156], hair: 'bald',   c: [126, 130, 96], facial: 'stubble' },
  meredith:  { display: 'Meredith',  skin: 'light', hairc: [154, 82, 46],   hair: 'messy',  hlen: 15, c: [176, 86, 74], fem: true },
};

// display order = cast.ts OFFICE_CAST order, IMAJU first grouped by usefulness.
export const CAST_ORDER = [
  'sofia', 'mateo', 'valentina', 'diego', 'camila', 'lucas', 'elena', 'andres',
  'mariana', 'javier', 'isabella', 'carlos', 'gabriela', 'rafael', 'daniela',
  'tomas', 'paula', 'nicolas', 'renata', 'emilio',
  'michael', 'jim', 'pam', 'dwight', 'kevin', 'angela', 'oscar', 'stanley',
  'phyllis', 'andy', 'kelly', 'ryan', 'toby', 'creed', 'meredith',
];

// department -> characters seated there (from data/hermesRoster.ts ROSTER).
export const ROOM_MEMBERS = {
  'Dirección':      [['paula', 'Recepcionista'], ['javier', 'Orquestador · CEO']],
  'Desarrollo':     [['mateo', 'Arquitecto'], ['diego', 'Implementador'], ['andres', 'Revisor Dev']],
  'Creativo':       [['valentina', 'Director de Arte'], ['isabella', 'Productor'], ['gabriela', 'Revisor Creativo']],
  'Marketing':      [['sofia', 'Estratega'], ['camila', 'SEO'], ['rafael', 'Revisor Marketing']],
  'Finanzas':       [['carlos', 'Analista'], ['daniela', 'Contralor']],
  'Redacción':      [['lucas', 'Redactor'], ['mariana', 'Editor'], ['tomas', 'Revisor Redacción']],
  'Ciberseguridad': [['elena', 'Auditor de Seguridad'], ['emilio', 'Seg. de sistemas']],
};
