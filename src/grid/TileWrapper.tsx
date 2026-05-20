/*
Copyright 2023, 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  type ComponentType,
  type JSX,
  memo,
  type RefObject,
  useEffect,
  useRef,
} from "react";
import { type EventTypes, type Handler, useDrag } from "@use-gesture/react";
import { type SpringValue } from "@react-spring/web";
import classNames from "classnames";

import { type TileProps } from "./Grid";
import styles from "./TileWrapper.module.css";

interface Props<M, R extends HTMLElement> {
  id: string;
  onDrag: RefObject<
    (
      tileId: string,
      state: Parameters<Handler<"drag", EventTypes["drag"]>>[0],
    ) => void
  > | null;
  onDoubleClick?: () => void;
  /**
   * The width this tile will have once its animations have settled.
   */
  targetWidth: number;
  /**
   * The width this tile will have once its animations have settled.
   */
  targetHeight: number;
  model: M;
  Tile: ComponentType<TileProps<M, R>>;
  opacity: SpringValue<number>;
  scale: SpringValue<number>;
  zIndex: SpringValue<number>;
  x: SpringValue<number>;
  y: SpringValue<number>;
  width: SpringValue<number>;
  height: SpringValue<number>;
}

const TileWrapper_ = memo(
  <M, R extends HTMLElement>({
    id,
    onDrag,
    onDoubleClick,
    targetWidth,
    targetHeight,
    model,
    Tile,
    opacity,
    scale,
    zIndex,
    x,
    y,
    width,
    height,
  }: Props<M, R>) => {
    const ref = useRef<R | null>(null);

    useDrag((state) => onDrag?.current!(id, state), {
      target: ref,
      filterTaps: true,
      // Previous designs, which allowed tiles to be dragged and dropped around
      // the scrolling grid, required us to set preventScroll to true here. But
      // our designs no longer call for this, and meanwhile there's a bug in
      // use-gesture that causes filterTaps + preventScroll to break buttons
      // within tiles (like the 'switch camera' button) on mobile.
      // https://github.com/pmndrs/use-gesture/issues/593
    });

    // Double-click is bound capturing-style: if the inner tile contains
    // interactive buttons, this still fires when the user double-clicks the
    // tile body. Single clicks remain available to the inner UI.
    useEffect(() => {
      if (onDoubleClick === undefined) return;
      const el = ref.current;
      if (el === null) return;
      const handler = (e: Event): void => {
        // Don't trigger when double-clicking interactive controls inside the
        // tile (mute, switch camera, etc.) - those have buttons/role=button.
        if ((e.target as Element | null)?.closest("button,[role='button']"))
          return;
        onDoubleClick();
      };
      el.addEventListener("dblclick", handler);
      return (): void => el.removeEventListener("dblclick", handler);
    }, [onDoubleClick]);

    return (
      <Tile
        ref={ref}
        className={classNames(styles.tile, { [styles.draggable]: onDrag })}
        style={{
          opacity,
          scale,
          zIndex,
          x,
          y,
          width,
          height,
        }}
        targetWidth={targetWidth}
        targetHeight={targetHeight}
        model={model}
      />
    );
  },
);

TileWrapper_.displayName = "TileWrapper";

/**
 * A wrapper around a tile in a video grid. This component exists to decouple
 * child components from the grid.
 */
// We pretend this component is a simple function rather than a
// NamedExoticComponent, because that's the only way we can fit in a type
// parameter
export const TileWrapper = TileWrapper_ as <M, R extends HTMLElement>(
  props: Props<M, R>,
) => JSX.Element;
