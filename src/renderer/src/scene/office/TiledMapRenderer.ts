import { Container, Sprite, Texture, Rectangle, Graphics } from 'pixi.js';
import {
  Projection,
  orthoProjection,
  tileToPixel as projTileToPixel,
  tileToFoot as projTileToFoot,
  depthKey as projDepthKey,
} from './projection';
import { accentByName } from '@/design/tokens';
import { DEPARTMENT_ACCENT, type Department } from '@/data/hermesRoster';

// Trimmed port of shahar061/the-office (office/engine/TiledMapRenderer.ts):
// renders floor/walls/furniture tile layers and parses collision, spawn-points
// and zones. Interactive-object / war-room / monitor-glow extraction is dropped
// (we render every tile statically), so no tiles ever go missing.

const FLIPPED_H_FLAG = 0x80000000;
const FLIPPED_V_FLAG = 0x40000000;
const FLIPPED_D_FLAG = 0x20000000;
const TILE_ID_MASK = 0x1fffffff;

export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTilesetRef[];
}

export interface TiledLayer {
  name: string;
  type: 'tilelayer' | 'objectgroup';
  data?: number[];
  objects?: TiledObject[];
}

export interface TiledObject {
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface TiledTilesetRef {
  firstgid: number;
  source?: string;
  image?: string;
  columns?: number;
  tilewidth?: number;
  tileheight?: number;
  tilecount?: number;
}

export interface ZoneRect { x: number; y: number; width: number; height: number; }
export interface Point { x: number; y: number; }

const TILE_LAYERS = ['floor', 'walls', 'furniture-below', 'furniture-above'] as const;
const COLLISION_LAYER = 'collision';
const SPAWN_POINTS_LAYER = 'spawn-points';
const ZONES_LAYER = 'zones';

export class TiledMapRenderer {
  readonly width: number;
  readonly height: number;
  readonly tileSize: number;

  private walkabilityGrid: boolean[][] = [];
  private spawnPoints: Map<string, Point> = new Map();
  private zones: Map<string, ZoneRect> = new Map();
  private characterContainer: Container;
  private rootContainer: Container;
  private projection: Projection;

  private static readonly WALKABLE_SPAWN_PREFIXES = ['desk-', 'pc-', 'warroom-', 'entrance'];

  constructor(
    private mapData: TiledMap,
    private tilesetTextures: Texture[],
    projection?: Projection,
  ) {
    this.width = mapData.width;
    this.height = mapData.height;
    this.tileSize = mapData.tilewidth;
    // Default keeps the exact prior top-down geometry — passing an iso
    // projection is what flips the office to isometric (see projection.ts).
    this.projection = projection ?? orthoProjection(this.tileSize);
    this.rootContainer = new Container();
    this.characterContainer = new Container();
    this.characterContainer.sortableChildren = true;

    this.parseCollisionLayer();
    this.parseSpawnPoints();
    this.markWalkableSpawnPoints();
    this.parseZones();
    this.buildTileLayers();
  }

  getContainer(): Container { return this.rootContainer; }
  getCharacterContainer(): Container { return this.characterContainer; }

  isWalkable(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return false;
    return this.walkabilityGrid[ty][tx];
  }

  getProjection(): Projection { return this.projection; }

  tileToPixel(tx: number, ty: number): Point {
    return projTileToPixel(this.projection, tx, ty);
  }

  /** A character's foot-anchor pixel for a tile (bottom-center of the tile).
   *  Single source for the `+tileSize/2, +tileSize` offset that spawn, sit and
   *  walk used to each recompute by hand — so a projection change lands here. */
  tileToFoot(tx: number, ty: number): Point {
    return projTileToFoot(this.projection, tx, ty);
  }

  /** Baseline depth-sort key for anything standing on a tile (tiles and
   *  characters share it, so one sortable container orders them correctly). */
  depthKey(tx: number, ty: number): number {
    return projDepthKey(this.projection, tx, ty);
  }

  pixelToTile(px: number, py: number): Point {
    return { x: Math.floor(px / this.tileSize), y: Math.floor(py / this.tileSize) };
  }

  getSpawnPoint(name: string): Point | undefined { return this.spawnPoints.get(name); }
  getAllSpawnPoints(): Map<string, Point> { return this.spawnPoints; }
  getZone(name: string): ZoneRect | undefined { return this.zones.get(name); }
  getAllZones(): Map<string, ZoneRect> { return this.zones; }

  /** The (flip-stripped) gid painted at a tile of a layer, 0 when empty.
   *  Lets the scene locate furniture by art — e.g. each desk's monitor block. */
  gidAt(layerName: string, tx: number, ty: number): number {
    const layer = this.findLayer(layerName, 'tilelayer');
    if (!layer?.data || tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return 0;
    return (layer.data[ty * this.width + tx] ?? 0) & TILE_ID_MASK;
  }

  /** A sub-texture for one tileset tile, addressed by gid — for dynamic props
   *  that reuse map art (e.g. the lit monitor variant overlaid when an agent
   *  sits down). Returns undefined for gid 0 / out-of-range.
   *  NOTE: allocates a fresh Texture per call and the CALLER owns its lifetime
   *  (fine for constructor-time use, kept alive by sprites; do NOT call this
   *  per frame or the textures leak). */
  textureForGid(gid: number): Texture | undefined {
    const tileId = gid & TILE_ID_MASK;
    if (tileId === 0) return undefined;
    const resolved = this.resolveTileset(tileId);
    if (!resolved) return undefined;
    const { tileset, texture } = resolved;
    const cols = tileset.columns ?? 16;
    const tw = tileset.tilewidth ?? this.tileSize;
    const th = tileset.tileheight ?? this.tileSize;
    const localId = tileId - tileset.firstgid;
    const frame = new Rectangle((localId % cols) * tw, Math.floor(localId / cols) * th, tw, th);
    return new Texture({ source: texture.source, frame });
  }

  private parseCollisionLayer(): void {
    const layer = this.findLayer(COLLISION_LAYER, 'tilelayer');
    this.walkabilityGrid = Array.from({ length: this.height }, () => Array(this.width).fill(true));
    if (!layer?.data) return;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const rawId = layer.data[y * this.width + x];
        if ((rawId & TILE_ID_MASK) !== 0) this.walkabilityGrid[y][x] = false;
      }
    }
  }

  private parseSpawnPoints(): void {
    const layer = this.findLayer(SPAWN_POINTS_LAYER, 'objectgroup');
    if (!layer?.objects) return;
    for (const obj of layer.objects) {
      this.spawnPoints.set(obj.name, {
        x: Math.floor(obj.x / this.tileSize),
        y: Math.floor(obj.y / this.tileSize),
      });
    }
  }

  /** Force seat/desk tiles walkable so agents can path onto them even though
   *  the underlying chair/desk tile is non-walkable in the collision layer. */
  private markWalkableSpawnPoints(): void {
    for (const [name, point] of this.spawnPoints) {
      if (!TiledMapRenderer.WALKABLE_SPAWN_PREFIXES.some((p) => name.startsWith(p))) continue;
      if (point.y >= 0 && point.y < this.height && point.x >= 0 && point.x < this.width) {
        this.walkabilityGrid[point.y][point.x] = true;
      }
    }
  }

  private parseZones(): void {
    const layer = this.findLayer(ZONES_LAYER, 'objectgroup');
    if (!layer?.objects) return;
    for (const obj of layer.objects) {
      this.zones.set(obj.name, {
        x: Math.floor(obj.x / this.tileSize),
        y: Math.floor(obj.y / this.tileSize),
        width: Math.floor((obj.width ?? 0) / this.tileSize),
        height: Math.floor((obj.height ?? 0) / this.tileSize),
      });
    }
  }

  private resolveTileset(tileId: number): { tileset: TiledTilesetRef; texture: Texture } | undefined {
    for (let i = this.mapData.tilesets.length - 1; i >= 0; i--) {
      if (tileId >= this.mapData.tilesets[i].firstgid) {
        return { tileset: this.mapData.tilesets[i], texture: this.tilesetTextures[i] };
      }
    }
    return undefined;
  }

  private buildTileLayers(): void {
    // ISO retrofit (stage 1, RETROFIT_PLAN.md §3.3b): draw a procedural
    // isometric floor from the logical grid + department zones instead of the
    // top-down tileset layers. Characters (positioned via tileToFoot, which is
    // now iso) render on top. Furniture/decorations stay a later stage.
    if (this.projection.kind === 'iso') {
      this.buildIsoFloor();
      this.rootContainer.addChild(this.characterContainer);
      return;
    }
    if (this.mapData.tilesets.length === 0) return;

    for (const layerName of TILE_LAYERS) {
      const layer = this.findLayer(layerName, 'tilelayer');
      const container = new Container();
      container.label = layerName;

      if (layer?.data) {
        for (let y = 0; y < this.height; y++) {
          for (let x = 0; x < this.width; x++) {
            const raw = layer.data[y * this.width + x];
            if (raw === 0) continue;

            const flippedH = (raw & FLIPPED_H_FLAG) !== 0;
            const flippedV = (raw & FLIPPED_V_FLAG) !== 0;
            const flippedD = (raw & FLIPPED_D_FLAG) !== 0;
            const tileId = raw & TILE_ID_MASK;

            const resolved = this.resolveTileset(tileId);
            if (!resolved) continue;

            const { tileset, texture } = resolved;
            const cols = tileset.columns ?? 16;
            const tw = tileset.tilewidth ?? this.tileSize;
            const th = tileset.tileheight ?? this.tileSize;
            const localId = tileId - tileset.firstgid;
            const srcX = (localId % cols) * tw;
            const srcY = Math.floor(localId / cols) * th;

            const frame = new Rectangle(srcX, srcY, tw, th);
            const sprite = new Sprite(new Texture({ source: texture.source, frame }));

            if (flippedH || flippedV || flippedD) {
              sprite.anchor.set(0.5, 0.5);
              sprite.x = x * this.tileSize + this.tileSize / 2;
              sprite.y = y * this.tileSize + this.tileSize / 2;
              if (flippedD) {
                if (flippedH && !flippedV) {
                  sprite.rotation = Math.PI / 2;
                } else if (!flippedH && flippedV) {
                  sprite.rotation = -Math.PI / 2;
                } else if (flippedH && flippedV) {
                  sprite.rotation = Math.PI / 2;
                  sprite.scale.y = -1;
                } else {
                  sprite.rotation = Math.PI / 2;
                  sprite.scale.x = -1;
                }
              } else {
                if (flippedH) sprite.scale.x = -1;
                if (flippedV) sprite.scale.y = -1;
              }
            } else {
              sprite.x = x * this.tileSize;
              sprite.y = y * this.tileSize;
            }

            container.addChild(sprite);
          }
        }
      }

      this.rootContainer.addChild(container);
    }

    // Characters render above every tile layer.
    this.rootContainer.addChild(this.characterContainer);
  }

  /** Procedural isometric floor: one diamond per tile, department zones tinted
   *  with their accent, everything else a neutral floor. Two-shade checker for
   *  read. Drawn in one Graphics behind the character container. */
  private buildIsoFloor(): void {
    if (this.projection.kind !== 'iso') return;
    const p = this.projection;
    const hw = p.tileW / 2, hh = p.tileH / 2;

    // per-tile department lookup from the zones layer
    const zoneOf: (string | undefined)[] = new Array(this.width * this.height);
    for (const [name, r] of this.zones) {
      for (let y = r.y; y < r.y + r.height; y++) {
        for (let x = r.x; x < r.x + r.width; x++) {
          if (x >= 0 && y >= 0 && x < this.width && y < this.height) zoneOf[y * this.width + x] = name;
        }
      }
    }

    const NEUTRAL = 0x8f9a86; // warm office-floor grey-green
    const g = new Graphics();
    for (let ty = 0; ty < this.height; ty++) {
      for (let tx = 0; tx < this.width; tx++) {
        const dept = zoneOf[ty * this.width + tx];
        const base = dept ? accentByName[DEPARTMENT_ACCENT[dept as Department]] ?? NEUTRAL : NEUTRAL;
        // department tiles lift toward their accent; plain floor stays muted
        const light = mixHex(base, 0xffffff, dept ? 0.55 : 0.72);
        const dark = mixHex(base, 0xffffff, dept ? 0.44 : 0.66);
        const c = (tx + ty) % 2 === 0 ? light : dark;
        const { x, y } = projTileToFoot(p, tx, ty);
        g.poly([x, y - hh, x + hw, y, x, y + hh, x - hw, y]).fill({ color: c });
      }
    }
    g.zIndex = -1e9;
    this.rootContainer.addChild(g);
  }

  private findLayer(name: string, type: 'tilelayer' | 'objectgroup'): TiledLayer | undefined {
    return this.mapData.layers.find((l) => l.name === name && l.type === type);
  }
}

function mixHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t), gg = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (gg << 8) | bl;
}
