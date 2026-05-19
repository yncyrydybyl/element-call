/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type CSSProperties, type ReactNode, useMemo } from "react";
import { useObservableEagerState } from "observable-hooks";

import { type FreeStageLayout as FreeStageLayoutModel } from "../state/layout-types.ts";
import styles from "./FreeStageLayout.module.css";
import { type CallLayout, arrangeTiles } from "./CallLayout";
import { useUpdateLayout, useVisibleTiles } from "./Grid";

interface FreeStageCSSProperties extends CSSProperties {
  "--gap": string;
  "--tile-width": string;
  "--tile-height": string;
}

interface FreeStageSlotCSSProperties extends CSSProperties {
  "--rotate": string;
  "--scale": string;
  "--translate-y": string;
  "--z-index": number;
}

// A simple deterministic pseudo-random number generator so the tile offsets
// stay stable across re-renders for the same participant set.
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

/**
 * An implementation of the "free-stage" layout, in which participant tiles
 * are arranged in a free-form, slightly playful grid with small per-tile
 * rotations, scales and offsets so the stage feels alive rather than rigid.
 */
export const makeFreeStageLayout: CallLayout<FreeStageLayoutModel> = ({
  minBounds$,
}) => ({
  foreground: "scrolling",

  fixed: function FreeStageLayoutFixed({ ref }): ReactNode {
    useUpdateLayout();
    useObservableEagerState(minBounds$);
    return <div ref={ref} className={styles.fixed} />;
  },

  scrolling: function FreeStageLayout({ ref, model, Slot }): ReactNode {
    useUpdateLayout();
    useVisibleTiles(model.setVisibleTiles);
    const { width, height: minHeight } = useObservableEagerState(minBounds$);
    const { gap, tileWidth, tileHeight } = useMemo(
      () => arrangeTiles(width, minHeight, model.grid.length),
      [width, minHeight, model.grid.length],
    );

    return (
      <div
        ref={ref}
        className={styles.stage}
        style={
          {
            width,
            "--gap": `${gap}px`,
            "--tile-width": `${Math.floor(tileWidth * 0.92)}px`,
            "--tile-height": `${Math.floor(tileHeight * 0.92)}px`,
          } as FreeStageCSSProperties
        }
      >
        {model.grid.map((m) => {
          const r1 = hash(`${m.id}-r`);
          const r2 = hash(`${m.id}-t`);
          const r3 = hash(`${m.id}-s`);
          const rotate = (r1 - 0.5) * 6; // ± 3 degrees
          const translateY = (r2 - 0.5) * 24; // ± 12 px
          const scale = 0.94 + r3 * 0.12; // 0.94 .. 1.06
          return (
            <Slot
              key={m.id}
              className={styles.slot}
              id={m.id}
              model={m}
              style={
                {
                  "--rotate": `${rotate.toFixed(2)}deg`,
                  "--translate-y": `${translateY.toFixed(1)}px`,
                  "--scale": scale.toFixed(3),
                  // Larger tiles sit on top so the overlap reads as depth.
                  "--z-index": Math.round(scale * 100),
                } as FreeStageSlotCSSProperties
              }
            />
          );
        })}
      </div>
    );
  },
});
