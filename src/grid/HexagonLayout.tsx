/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type CSSProperties, type ReactNode, useMemo } from "react";
import { useObservableEagerState } from "observable-hooks";

import { type HexagonLayout as HexagonLayoutModel } from "../state/layout-types.ts";
import styles from "./HexagonLayout.module.css";
import { type CallLayout } from "./CallLayout";
import { useUpdateLayout, useVisibleTiles } from "./Grid";

interface HexagonCSSProperties extends CSSProperties {
  "--hex-width": string;
  "--hex-height": string;
  "--hex-row-spacing": string;
  "--hex-col-offset": string;
}

interface HexagonArrangement {
  hexWidth: number;
  hexHeight: number;
  columns: number;
}

// Arrange hexagons in a honeycomb: alternating rows are offset by half a tile
// horizontally, and rows overlap vertically by 1/4 of the hex height.
function arrangeHexagons(
  width: number,
  height: number,
  tileCount: number,
): HexagonArrangement {
  if (tileCount === 0) return { hexWidth: 0, hexHeight: 0, columns: 1 };
  // Hexagon vertical-to-horizontal ratio for a regular flat-top hexagon used
  // with clip-path below: height = width * sqrt(3) / 2 ≈ width * 0.866.
  const hexAspectRatio = Math.sqrt(3) / 2;
  // Effective row height is 3/4 of hex height because rows overlap.
  // For C columns and R rows the bounding box is roughly:
  //   width  ≈ (C + 0.5) * hexWidth
  //   height ≈ (R * 0.75 + 0.25) * hexHeight
  // We pick columns to make the tiles use the available area while keeping a
  // reasonable size.
  let bestColumns = 1;
  let bestHexWidth = 0;
  for (let columns = 1; columns <= tileCount; columns++) {
    const rows = Math.ceil(tileCount / columns);
    const widthLimit = width / (columns + 0.5);
    const heightLimit = height / ((rows * 0.75 + 0.25) * hexAspectRatio);
    const hexWidth = Math.max(0, Math.min(widthLimit, heightLimit));
    if (hexWidth > bestHexWidth) {
      bestHexWidth = hexWidth;
      bestColumns = columns;
    }
  }
  return {
    hexWidth: bestHexWidth,
    hexHeight: bestHexWidth * hexAspectRatio,
    columns: bestColumns,
  };
}

/**
 * An implementation of the "hexagon" layout, in which participant tiles are
 * shaped as hexagons and tessellated in a honeycomb pattern.
 */
export const makeHexagonLayout: CallLayout<HexagonLayoutModel> = ({
  minBounds$,
}) => ({
  foreground: "scrolling",

  fixed: function HexagonLayoutFixed({ ref }): ReactNode {
    useUpdateLayout();
    useObservableEagerState(minBounds$);
    return <div ref={ref} className={styles.fixed} />;
  },

  scrolling: function HexagonLayout({ ref, model, Slot }): ReactNode {
    useUpdateLayout();
    useVisibleTiles(model.setVisibleTiles);
    const { width, height } = useObservableEagerState(minBounds$);
    const { hexWidth, hexHeight, columns } = useMemo(
      () => arrangeHexagons(width, height, model.grid.length),
      [width, height, model.grid.length],
    );

    // Pack tiles into rows of `columns` items. The grid lays each row out
    // horizontally; odd rows are offset by half a tile via CSS to interlock.
    const rows: (typeof model.grid)[] = [];
    for (let i = 0; i < model.grid.length; i += columns) {
      rows.push(model.grid.slice(i, i + columns));
    }

    return (
      <div
        ref={ref}
        className={styles.honeycomb}
        style={
          {
            "--hex-width": `${Math.floor(hexWidth)}px`,
            "--hex-height": `${Math.floor(hexHeight)}px`,
            "--hex-row-spacing": `${Math.floor(hexHeight * 0.75)}px`,
            "--hex-col-offset": `${Math.floor(hexWidth / 2)}px`,
          } as HexagonCSSProperties
        }
      >
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={styles.row}
            data-row-parity={rowIndex % 2 === 0 ? "even" : "odd"}
          >
            {row.map((m) => (
              <Slot key={m.id} className={styles.slot} id={m.id} model={m} />
            ))}
          </div>
        ))}
      </div>
    );
  },
});
