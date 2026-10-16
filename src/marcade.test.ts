/*
Copyright 2026 Yan Minagawa (Marcade fork of Element Call)

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE-AGPL-3.0 in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import {
  computeUrlParams,
  configurationForIntent,
  UserIntent,
} from "./UrlParams";
import { missingWidgetParamsError, WIDGET_URL_TEMPLATE } from "./marcade";
import { mockConfig } from "./utils/test";

mockConfig();

// What the Marcade Player appends to a store widget, already substituted.
const PLAYER_QUERY =
  "?theme=dark&matrix_user_id=%40alice%3Aexample.org" +
  "&matrix_room_id=%21room%3Aexample.org&matrix_widget_id=w1" +
  "&matrix_display_name=Alice&matrix_client_language=de" +
  "&matrix_base_url=https%3A%2F%2Fmatrix.example.org" +
  "&matrix_device_id=DEVICE&widgetId=w1&parentUrl=https%3A%2F%2Fplayer.example";

describe("Marcade parameter aliases", () => {
  it("reads the Player's matrix_* parameters", () => {
    const params = computeUrlParams(PLAYER_QUERY, "");
    expect(params.isWidget).toBe(true);
    expect(params.roomId).toBe("!room:example.org");
    expect(params.userId).toBe("@alice:example.org");
    expect(params.deviceId).toBe("DEVICE");
    expect(params.baseUrl).toBe("https://matrix.example.org");
    expect(params.displayName).toBe("Alice");
    expect(params.lang).toBe("de");
    expect(params.theme).toBe("dark");
  });

  it("prefers Element Call's own parameter names", () => {
    const params = computeUrlParams(
      PLAYER_QUERY,
      "#?userId=%40bob%3Aexample.org",
    );
    expect(params.userId).toBe("@bob:example.org");
  });

  it("treats an unresolved template variable as absent", () => {
    const params = computeUrlParams(
      "?widgetId=w1&parentUrl=https%3A%2F%2Fx.example" +
        "&matrix_device_id=$org.matrix.msc3819.matrix_device_id",
      "",
    );
    expect(params.deviceId).toBeNull();
  });
});

describe("Marcade widget defaults", () => {
  it("behaves as a call in the room when no intent is given", () => {
    const params = computeUrlParams(PLAYER_QUERY, "");
    expect(params).toMatchObject(
      configurationForIntent(UserIntent.JoinExistingCall),
    );
    expect(params.confineToRoom).toBe(true);
    expect(params.skipLobby).toBe(false);
  });

  it("keeps an explicit intent", () => {
    const params = computeUrlParams(`${PLAYER_QUERY}&intent=start_call`, "");
    expect(params).toMatchObject(
      configurationForIntent(UserIntent.StartNewCall),
    );
  });
});

describe("missingWidgetParamsError", () => {
  it("is null outside a widget and with complete parameters", () => {
    expect(missingWidgetParamsError(computeUrlParams("", ""))).toBeNull();
    expect(
      missingWidgetParamsError(computeUrlParams(PLAYER_QUERY, "")),
    ).toBeNull();
  });

  it("names what is missing and the /addwidget line that fixes it", () => {
    const error = missingWidgetParamsError(
      computeUrlParams("?widgetId=w1&parentUrl=https%3A%2F%2Fx.example", ""),
    );
    expect(error?.message).toContain(
      "missing: roomId, userId, deviceId, baseUrl",
    );
    expect(error?.message).toContain(`/addwidget `);
    expect(error?.message).toContain(WIDGET_URL_TEMPLATE);
  });

  it("is satisfied by the template once a client substitutes it", () => {
    const substituted = WIDGET_URL_TEMPLATE.replace("$matrix_room_id", "!r:x")
      .replace("$matrix_user_id", "@u:x")
      .replace("$org.matrix.msc3819.matrix_device_id", "D")
      .replace("$org.matrix.msc4039.matrix_base_url", "https://x");
    const params = computeUrlParams(
      "?widgetId=w1&parentUrl=https%3A%2F%2Fx.example",
      substituted,
    );
    expect(missingWidgetParamsError(params)).toBeNull();
  });
});
