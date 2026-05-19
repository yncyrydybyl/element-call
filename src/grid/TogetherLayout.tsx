/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type CSSProperties, type ReactNode, useMemo } from "react";
import { useObservableEagerState } from "observable-hooks";

import { type TogetherLayout as TogetherLayoutModel } from "../state/layout-types.ts";
import styles from "./TogetherLayout.module.css";
import { type CallLayout } from "./CallLayout";
import { useUpdateLayout, useVisibleTiles } from "./Grid";

interface TogetherCSSProperties extends CSSProperties {
  "--tile-width": string;
  "--tile-height": string;
  "--gap": string;
}

// All participants share a single horizontal "bench". We pick a tile size that
// fits the bench end-to-end while keeping a roughly 4:3 aspect ratio.
function arrangeBench(
  width: number,
  height: number,
  tileCount: number,
): { tileWidth: number; tileHeight: number; gap: number } {
  const gap = width < 800 ? 12 : 16;
  if (tileCount === 0) return { tileWidth: 0, tileHeight: 0, gap };
  const maxTileHeight = Math.min(height * 0.7, 320);
  const maxTotalWidth = width - gap * 2;
  // Start from the height limit, see if the row fits horizontally.
  let tileHeight = maxTileHeight;
  let tileWidth = tileHeight * (4 / 3);
  const totalWidth = tileWidth * tileCount + gap * (tileCount - 1);
  if (totalWidth > maxTotalWidth) {
    tileWidth = (maxTotalWidth - gap * (tileCount - 1)) / tileCount;
    tileHeight = tileWidth * (3 / 4);
  }
  return { tileWidth, tileHeight, gap };
}

/**
 * An implementation of the "together" layout, in which every participant is
 * placed side-by-side on a single virtual bench at the bottom of the screen,
 * evoking the feeling of being in the same room together.
 */
export const makeTogetherLayout: CallLayout<TogetherLayoutModel> = ({
  minBounds$,
}) => ({
  foreground: "scrolling",

  fixed: function TogetherLayoutFixed({ ref }): ReactNode {
    useUpdateLayout();
    useObservableEagerState(minBounds$);
    return <div ref={ref} className={styles.fixed} />;
  },

  scrolling: function TogetherLayout({ ref, model, Slot }): ReactNode {
    useUpdateLayout();
    useVisibleTiles(model.setVisibleTiles);
    const { width, height } = useObservableEagerState(minBounds$);
    const { tileWidth, tileHeight, gap } = useMemo(
      () => arrangeBench(width, height, model.grid.length),
      [width, height, model.grid.length],
    );

    return (
      <div
        ref={ref}
        className={styles.bench}
        style={
          {
            "--tile-width": `${Math.floor(tileWidth)}px`,
            "--tile-height": `${Math.floor(tileHeight)}px`,
            "--gap": `${gap}px`,
          } as TogetherCSSProperties
        }
      >
        <div className={styles.row}>
          {model.grid.map((m) => (
            <Slot key={m.id} className={styles.slot} id={m.id} model={m} />
          ))}
        </div>
      </div>
    );
  },
});
