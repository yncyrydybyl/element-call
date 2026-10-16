/*
Copyright 2026 Yan Minagawa (Marcade fork of Element Call)

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE-AGPL-3.0 in the repository root for full details.
*/

// Marcade fork: what it takes for Element Call to run as a widget installed
// from marcade.store, rather than as the call widget a client sets up itself.

/**
 * Parameter names that the Marcade Player (and the matrix-widget-toolkit
 * convention it follows) append to every hosted widget, keyed by the Element
 * Call parameter they stand in for. Element Call's own name always wins.
 */
export const PARAM_ALIASES: Readonly<Record<string, string>> = {
  roomId: "matrix_room_id",
  userId: "matrix_user_id",
  deviceId: "matrix_device_id",
  baseUrl: "matrix_base_url",
  displayName: "matrix_display_name",
  lang: "matrix_client_language",
  theme: "matrix_client_theme",
};

/**
 * Whether a parameter value is a template variable the host left unresolved
 * (e.g. `$org.matrix.msc3819.matrix_device_id` on a client that does not know
 * that variable), which is as good as the parameter being absent.
 */
export const isUnresolvedTemplate = (value: string): boolean =>
  value.startsWith("$");

/**
 * The fragment to append to the store URL so that a client fills in what
 * Element Call needs to know about the room and the user. Element Web
 * substitutes all of these.
 */
export const WIDGET_URL_TEMPLATE =
  "#?roomId=$matrix_room_id" +
  "&userId=$matrix_user_id" +
  "&deviceId=$org.matrix.msc3819.matrix_device_id" +
  "&baseUrl=$org.matrix.msc4039.matrix_base_url" +
  "&displayName=$matrix_display_name" +
  "&theme=$org.matrix.msc2873.client_theme" +
  "&lang=$org.matrix.msc2873.client_language";

/**
 * The error to show when Element Call is framed as a widget but the widget URL
 * does not tell it which room, user and device it is in (for example a bare
 * `/addwidget https://marcade.store/apps/…/` in Element Web), or null if it
 * has what it needs.
 */
export function missingWidgetParamsError(params: {
  isWidget: boolean;
  roomId: string | null;
  userId: string | null;
  deviceId: string | null;
  baseUrl: string | null;
}): Error | null {
  if (!params.isWidget) return null;
  const missing = (["roomId", "userId", "deviceId", "baseUrl"] as const).filter(
    (name) => !params[name],
  );
  if (missing.length === 0) return null;
  const base =
    window.location.origin +
    window.location.pathname.replace(/index\.html$/, "");
  return new Error(
    `This widget URL does not say which room and user the call is for ` +
      `(missing: ${missing.join(", ")}). Remove the widget and add it again ` +
      `with:\n\n/addwidget ${base}${WIDGET_URL_TEMPLATE}`,
  );
}
