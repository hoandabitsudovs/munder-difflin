// Design tokens — single source of truth. Mirrors tokens.css for non-styled consumers (Pixi).
// Any change here must also update tokens.css.

export const colors = {
  // v0.5 "Liquid Glass" retone — cool light neutrals (mirrors tokens.css).
  cream: {
    50: 0xf5f7fc,
    100: 0xeef1f8,
    200: 0xe4e9f3,
    300: 0xd4dbea
  },
  paper: {
    100: 0xffffff,
    200: 0xf1f4fb
  },
  ink: {
    900: 0x0a0f1c,
    700: 0x39415a,
    500: 0x69708a,
    300: 0xaab2c2,
    100: 0xdde3ec
  },
  // v0.5 retone: single Apple-blue accent for the whole UI (mirrors tokens.css).
  accent: {
    coral: 0x0a84ff,
    coralLight: 0xdcebff,
    mint: 0x0a84ff,
    mintLight: 0xdcebff,
    sky: 0x0a84ff,
    skyLight: 0xdcebff,
    lemon: 0x0a84ff,
    lemonLight: 0xdcebff,
    lilac: 0x0a84ff,
    lilacLight: 0xdcebff,
    peach: 0x0a84ff,
    peachLight: 0xdcebff
  },
  status: {
    idle: 0xa199ab,
    thinking: 0x4f9faf,
    working: 0xdcab3c,
    blocked: 0xd96a62,
    success: 0x5ca97a,
    ghost: 0xd9d3de
  },
  world: {
    grassLight: 0xd4eab0,
    grassDark: 0xb5d589,
    woodLight: 0xe5c896,
    woodDark: 0xc9a66b,
    path: 0xe8d8b0,
    wall: 0x8b6f47
  }
} as const;

export const space = {
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64
} as const;

export const type = {
  display: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Geeza Pro", "Noto Naskh Arabic", "Segoe UI Historic", sans-serif',
  ui: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Geeza Pro", "Noto Naskh Arabic", "Segoe UI Historic", sans-serif',
  mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, "PingFang SC", "Microsoft YaHei", "Noto Sans Mono CJK SC", "Noto Sans CJK SC", "Geeza Pro", "Noto Naskh Arabic", "Segoe UI Historic", monospace'
} as const;

export const tileSize = 32; // px — the world is built from 32×32 tiles

export type AccentColorName =
  | 'coral' | 'mint' | 'sky' | 'lemon' | 'lilac' | 'peach';

export const accentByName: Record<AccentColorName, number> = {
  coral: colors.accent.coral,
  mint:  colors.accent.mint,
  sky:   colors.accent.sky,
  lemon: colors.accent.lemon,
  lilac: colors.accent.lilac,
  peach: colors.accent.peach
};

export const accentLightByName: Record<AccentColorName, number> = {
  coral: colors.accent.coralLight,
  mint:  colors.accent.mintLight,
  sky:   colors.accent.skyLight,
  lemon: colors.accent.lemonLight,
  lilac: colors.accent.lilacLight,
  peach: colors.accent.peachLight
};

// Convert 0xRRGGBB to "#RRGGBB"
export function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0').toUpperCase();
}
