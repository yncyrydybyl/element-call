/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type BehaviorSubject } from "rxjs";

import {
  type Alignment,
  type Layout,
  type LayoutMedia,
} from "./layout-types.ts";
import { type TileStore } from "./TileStore";

export type GridLikeLayoutType =
  | "grid"
  | "spotlight-landscape"
  | "spotlight-portrait";

/**
 * Produces a grid-like layout (any layout with a grid and possibly a spotlight)
 * with the given media.
 */
export function gridLikeLayout(
  media: LayoutMedia & { type: GridLikeLayoutType },
  spotlightAlignment$: BehaviorSubject<Alignment>,
  visibleTiles: number,
  setVisibleTiles: (value: number) => void,
  prevTiles: TileStore,
): [Layout & { type: GridLikeLayoutType }, TileStore] {
  const update = prevTiles.from(visibleTiles);
  if (media.spotlight !== undefined)
    update.registerSpotlight(
      media.spotlight,
      media.type === "spotlight-portrait",
    );
  for (const mediaVm of media.grid) update.registerGridTile(mediaVm);
  const tiles = update.build();

  return [
    {
      type: media.type,
      spotlight: tiles.spotlightTile,
      grid: tiles.gridTiles,
      spotlightAlignment$,
      setVisibleTiles,
    } as Layout & { type: GridLikeLayoutType },
    tiles,
  ];
}

export type GridOnlyLayoutType =
  | "together"
  | "free-stage"
  | "hexagon"
  | "as-you-want";

/**
 * Produces a grid-only layout (no spotlight, just a grid of participant tiles)
 * with the given media. Used by the "together", "free-stage" and "hexagon"
 * modes which differ only in the visual arrangement of the tiles.
 */
export function gridOnlyLayout(
  media: LayoutMedia & { type: GridOnlyLayoutType },
  visibleTiles: number,
  setVisibleTiles: (value: number) => void,
  prevTiles: TileStore,
): [Layout & { type: GridOnlyLayoutType }, TileStore] {
  const update = prevTiles.from(visibleTiles);
  for (const mediaVm of media.grid) update.registerGridTile(mediaVm);
  const tiles = update.build();

  return [
    {
      type: media.type,
      grid: tiles.gridTiles,
      setVisibleTiles,
    } as Layout & { type: GridOnlyLayoutType },
    tiles,
  ];
}
