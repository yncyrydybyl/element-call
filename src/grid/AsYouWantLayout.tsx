/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useObservableEagerState } from "observable-hooks";

import { type AsYouWantLayout as AsYouWantLayoutModel } from "../state/layout-types.ts";
import styles from "./AsYouWantLayout.module.css";
import { type CallLayout, type Bounds } from "./CallLayout";
import { type DragCallback, useUpdateLayout, useVisibleTiles } from "./Grid";

interface AsYouWantCSSProperties extends CSSProperties {
  "--cols": number;
  "--cell-w": string;
  "--cell-h": string;
  "--gap": string;
}

interface SlotCSSProperties extends CSSProperties {
  "--col": number;
  "--row": number;
  "--span": number;
}

type Size = 1 | 2;

interface Placement {
  col: number;
  row: number;
  size: Size;
}

interface Arrangement {
  cols: number;
  cellW: number;
  cellH: number;
  gap: number;
}

// Pick the number of columns based on tile count and aspect ratio. We aim
// for tiles that are vaguely 4:3 so faces aren't stretched.
function arrange(bounds: Bounds, tileCount: number): Arrangement {
  const gap = bounds.width < 800 ? 12 : 16;
  if (tileCount === 0)
    return { cols: 1, cellW: bounds.width, cellH: bounds.height, gap };
  // Start from sqrt(N) and round so columns >= rows on landscape screens.
  const aspect = bounds.width / Math.max(bounds.height, 1);
  let cols = Math.max(1, Math.round(Math.sqrt(tileCount * aspect)));
  cols = Math.min(cols, tileCount);
  // Don't go wider than the bounding box can afford at a 4:3 minimum tile.
  const maxColsByWidth = Math.max(1, Math.floor(bounds.width / 180));
  cols = Math.min(cols, maxColsByWidth);
  const cellW = (bounds.width - gap * (cols + 1)) / cols;
  const cellH = (cellW * 3) / 4;
  return { cols, cellW, cellH, gap };
}

// Top-left-first scan for the first cell where a `size`-cell-sized box would
// fit without overlapping any existing placement.
function findFreeAnchor(
  placements: Map<string, Placement>,
  cols: number,
  size: Size,
  skipId?: string,
): { col: number; row: number } {
  const occupied = new Set<string>();
  for (const [id, p] of placements) {
    if (id === skipId) continue;
    for (let dx = 0; dx < p.size; dx++)
      for (let dy = 0; dy < p.size; dy++)
        occupied.add(`${p.col + dx},${p.row + dy}`);
  }
  for (let row = 0; row < 200; row++) {
    for (let col = 0; col + size <= cols; col++) {
      let ok = true;
      for (let dx = 0; dx < size && ok; dx++)
        for (let dy = 0; dy < size && ok; dy++)
          if (occupied.has(`${col + dx},${row + dy}`)) ok = false;
      if (ok) return { col, row };
    }
  }
  // Shouldn't happen for reasonable inputs but fall back to a new row.
  return { col: 0, row: 200 };
}

// Find every placement that overlaps the `size`-sized box anchored at
// (col, row), other than `selfId`.
function findOverlapping(
  placements: Map<string, Placement>,
  col: number,
  row: number,
  size: Size,
  selfId: string,
): string[] {
  const result: string[] = [];
  for (const [id, p] of placements) {
    if (id === selfId) continue;
    if (
      col + size > p.col &&
      p.col + p.size > col &&
      row + size > p.row &&
      p.row + p.size > row
    )
      result.push(id);
  }
  return result;
}

// Sync the placement Map with the current set of tile ids: drop placements
// for tiles that left, and assign first-free cells to tiles that joined.
function reconcile(
  prev: Map<string, Placement>,
  ids: string[],
  cols: number,
): Map<string, Placement> {
  const next = new Map<string, Placement>();
  const known = new Set(ids);
  for (const [id, p] of prev) if (known.has(id)) next.set(id, p);
  // Truncate placements that no longer fit horizontally after a column
  // count change (e.g. a 2x2 tile when columns drops to 1).
  for (const [id, p] of [...next]) {
    if (p.col + p.size > cols) {
      // Shrink 2x2 to 1x1 if it can't fit any more.
      if (p.size === 2 && cols >= 1) {
        next.set(id, { col: Math.min(p.col, cols - 1), row: p.row, size: 1 });
      } else {
        next.delete(id);
      }
    }
  }
  for (const id of ids) {
    if (next.has(id)) continue;
    const { col, row } = findFreeAnchor(next, cols, 1);
    next.set(id, { col, row, size: 1 });
  }
  return next;
}

/**
 * An implementation of the "as you want" layout: tiles start in a regular
 * matrix but can be dragged to swap positions, and double-clicking a tile
 * toggles it between a 1x1 and 2x2 footprint. Dropped tiles snap to the
 * nearest grid cell.
 */
export const makeAsYouWantLayout: CallLayout<AsYouWantLayoutModel> = ({
  minBounds$,
}) => ({
  foreground: "scrolling",

  fixed: function AsYouWantLayoutFixed({ ref }): ReactNode {
    useUpdateLayout();
    useObservableEagerState(minBounds$);
    return <div ref={ref} className={styles.fixed} />;
  },

  scrolling: function AsYouWantLayout({ ref, model, Slot }): ReactNode {
    useUpdateLayout();
    useVisibleTiles(model.setVisibleTiles);
    const bounds = useObservableEagerState(minBounds$);
    const ids = useMemo(() => model.grid.map((t) => t.id), [model.grid]);

    // Recompute the cell geometry on every render — cheap and avoids stale
    // values when the window resizes mid-drag.
    const { cols, cellW, cellH, gap } = useMemo(
      () => arrange(bounds, ids.length),
      [bounds, ids.length],
    );

    // Reconcile placements with the current tile set.
    const [placements, setPlacements] = useState<Map<string, Placement>>(
      () => new Map(),
    );
    const reconciled = useMemo(
      () => reconcile(placements, ids, cols),
      [placements, ids, cols],
    );
    useEffect(() => {
      if (reconciled !== placements) setPlacements(reconciled);
    }, [reconciled, placements]);

    // Keep a ref of the latest geometry so drag handlers see fresh values
    // without re-binding.
    const geometryRef = useRef({ cols, cellW, cellH, gap });
    geometryRef.current = { cols, cellW, cellH, gap };
    const placementsRef = useRef(reconciled);
    placementsRef.current = reconciled;

    const onDropTile = useCallback(
      (tileId: string, x: number, y: number): void => {
        const { cols: c, cellW: cw, cellH: ch, gap: g } = geometryRef.current;
        const current = placementsRef.current.get(tileId);
        if (current === undefined) return;
        // Convert the dropped pixel position to the nearest grid cell. x/y
        // are the tile's top-left in the grid's coordinate space.
        const rawCol = Math.round((x - g) / (cw + g));
        const rawRow = Math.round((y - g) / (ch + g));
        const maxCol = Math.max(0, c - current.size);
        const targetCol = Math.max(0, Math.min(rawCol, maxCol));
        const targetRow = Math.max(0, rawRow);

        if (targetCol === current.col && targetRow === current.row) return;

        setPlacements((prev) => {
          const next = new Map(prev);
          const overlapping = findOverlapping(
            next,
            targetCol,
            targetRow,
            current.size,
            tileId,
          );
          if (overlapping.length === 1) {
            // Swap with the single overlapping tile if both are the same
            // size; this gives the cleanest "drop & swap" feel.
            const otherId = overlapping[0];
            const other = next.get(otherId)!;
            if (other.size === current.size) {
              next.set(tileId, {
                col: targetCol,
                row: targetRow,
                size: current.size,
              });
              next.set(otherId, {
                col: current.col,
                row: current.row,
                size: other.size,
              });
              return next;
            }
          }
          // Otherwise: move the dragged tile, then evict anyone it now
          // overlaps to the first free cell.
          next.set(tileId, {
            col: targetCol,
            row: targetRow,
            size: current.size,
          });
          for (const id of overlapping) {
            const evicted = next.get(id)!;
            const anchor = findFreeAnchor(next, c, evicted.size, id);
            next.set(id, { ...anchor, size: evicted.size });
          }
          return next;
        });
      },
      [],
    );

    const onDoubleClickTile = useCallback((tileId: string): void => {
      setPlacements((prev) => {
        const current = prev.get(tileId);
        if (current === undefined) return prev;
        const next = new Map(prev);
        const newSize: Size = current.size === 1 ? 2 : 1;
        const { cols: c } = geometryRef.current;
        if (newSize === 2 && c < 2) return prev; // Can't grow if only 1 col.
        // Try the current anchor first; otherwise hunt for the closest
        // anchor that fits without overflowing the right edge.
        const candidates: { col: number; row: number }[] = [];
        const startCol = Math.min(current.col, c - newSize);
        const startRow = current.row;
        candidates.push({ col: Math.max(0, startCol), row: startRow });
        // Also try the original cell and its neighbours.
        for (let dr = 0; dr <= 1; dr++)
          for (let dc = -1; dc <= 0; dc++) {
            const col = Math.max(0, Math.min(current.col + dc, c - newSize));
            const row = Math.max(0, current.row + dr);
            candidates.push({ col, row });
          }
        let chosen = candidates[0];
        next.set(tileId, { ...chosen, size: newSize });
        // Pick the candidate whose overlap can be cheaply resolved (fewest
        // displaced 2x2 tiles).
        for (const c2 of candidates) {
          const ovs = findOverlapping(prev, c2.col, c2.row, newSize, tileId);
          const hasBig = ovs.some((id) => prev.get(id)!.size === 2);
          if (!hasBig) {
            chosen = c2;
            next.set(tileId, { ...c2, size: newSize });
            break;
          }
        }
        // Evict everyone the new placement overlaps.
        const overlapping = findOverlapping(
          next,
          chosen.col,
          chosen.row,
          newSize,
          tileId,
        );
        for (const id of overlapping) {
          const evicted = next.get(id)!;
          // Remove first so its old cells become free during the search.
          next.delete(id);
          const anchor = findFreeAnchor(next, c, evicted.size, id);
          next.set(id, { ...anchor, size: evicted.size });
        }
        return next;
      });
    }, []);

    // Compute rows from the deepest occupied cell, so the scrolling layer
    // can size itself.
    const rows = useMemo(() => {
      let max = 0;
      for (const p of reconciled.values()) max = Math.max(max, p.row + p.size);
      return Math.max(1, max);
    }, [reconciled]);

    return (
      <div
        ref={ref}
        className={styles.board}
        style={
          {
            "--cols": cols,
            "--cell-w": `${Math.floor(cellW)}px`,
            "--cell-h": `${Math.floor(cellH)}px`,
            "--gap": `${gap}px`,
            blockSize: `${rows * cellH + (rows + 1) * gap}px`,
            inlineSize: bounds.width,
          } as AsYouWantCSSProperties
        }
      >
        {model.grid.map((m) => {
          const p = reconciled.get(m.id);
          if (p === undefined) return null;
          const onDrag: DragCallback = ({ x, y }): void =>
            onDropTile(m.id, x, y);
          const onDoubleClick = (): void => onDoubleClickTile(m.id);
          return (
            <Slot
              key={m.id}
              className={styles.slot}
              id={m.id}
              model={m}
              onDrag={onDrag}
              onDoubleClick={onDoubleClick}
              style={
                {
                  "--col": p.col,
                  "--row": p.row,
                  "--span": p.size,
                } as SlotCSSProperties
              }
            />
          );
        })}
      </div>
    );
  },
});
