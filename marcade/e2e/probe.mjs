/*
Copyright 2026 Yan Minagawa (Marcade fork of Element Call)

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE-AGPL-3.0 in the repository root for full details.
*/

// Runs the built widget (dist/) in a mock Matrix client the way the Marcade
// Player frames it, and checks that
//   1. it requests exactly the capabilities listed in marcade/capabilities.txt
//      (the list the store entry declares), and reaches the lobby;
//   2. framed without room/user parameters, it explains how to add it instead.
// Usage: pnpm build:marcade && node marcade/e2e/probe.mjs [--write] [--shots <dir>]
//   --write   rewrite marcade/capabilities.txt from what the widget requested

import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "@playwright/test";

const root = new URL("../../", import.meta.url).pathname;
const args = process.argv.slice(2);
const write = args.includes("--write");
const shots = args.includes("--shots")
  ? args[args.indexOf("--shots") + 1]
  : null;

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  let pathname = normalize(decodeURIComponent(url.pathname));
  const host = pathname === "/__host__.html";
  if (pathname.endsWith("/")) pathname += "index.html";
  try {
    const body = await readFile(
      host ? join(root, "marcade/e2e/host.html") : join(root, "dist", pathname),
    );
    res.writeHead(200, {
      "Content-Type": types[extname(pathname)] ?? "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://localhost:${server.address().port}`;

// What the Player's STORE_URL_TEMPLATE expands to.
const PLAYER_QUERY = {
  theme: "light",
  matrix_user_id: "@alice:example.org",
  matrix_room_id: "!room:example.org",
  matrix_widget_id: "test-widget",
  matrix_display_name: "Alice",
  matrix_client_language: "en",
  matrix_base_url: "https://matrix.example.org",
  matrix_device_id: "ALICEDEVICE",
};

const browser = await chromium.launch({
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});
let failed = false;
const check = (ok, what) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failed = true;
};

async function open(fixture) {
  const context = await browser.newContext({
    viewport: { width: 1000, height: 700 },
    permissions: ["camera", "microphone"],
  });
  const page = await context.newPage();
  await page.addInitScript((f) => {
    window.__TEST_FIXTURE__ = f;
  }, fixture);
  page.on("console", (m) => {
    if (process.env.PROBE_DEBUG && ["error", "warning"].includes(m.type()))
      console.log(`[${m.type()}] ${m.text().slice(0, 300)}`);
  });
  await page.goto(`${origin}/__host__.html`);
  return page;
}

try {
  // 1. Installed from the store in the Player.
  const page = await open({
    query: PLAYER_QUERY,
    state: [
      {
        room_id: "!room:example.org",
        type: "m.room.create",
        state_key: "",
        sender: "@alice:example.org",
        content: { room_version: "11", creator: "@alice:example.org" },
        event_id: "$create",
        origin_server_ts: 0,
      },
      {
        room_id: "!room:example.org",
        type: "m.room.member",
        state_key: "@alice:example.org",
        sender: "@alice:example.org",
        content: { membership: "join", displayname: "Alice" },
        event_id: "$alice",
        origin_server_ts: 2,
      },
      {
        room_id: "!room:example.org",
        type: "m.room.name",
        state_key: "",
        sender: "@alice:example.org",
        content: { name: "Standup" },
        event_id: "$name",
        origin_server_ts: 1,
      },
    ],
  });
  await page.waitForFunction(() => window.__REQUESTED_CAPABILITIES__, null, {
    timeout: 30000,
  });
  // The store lists capabilities for any user, so the ids that Element Call
  // writes into some of them become placeholders.
  const requested = (
    await page.evaluate(() => window.__REQUESTED_CAPABILITIES__)
  )
    .map((c) =>
      c
        .replaceAll(PLAYER_QUERY.matrix_user_id, "{userId}")
        .replaceAll(PLAYER_QUERY.matrix_device_id, "{deviceId}")
        .replaceAll(PLAYER_QUERY.matrix_room_id, "{roomId}"),
    )
    .sort();
  const listFile = join(root, "marcade/capabilities.txt");
  if (write) {
    await writeFile(listFile, requested.join("\n") + "\n");
    console.log(`wrote ${requested.length} capabilities to ${listFile}`);
  } else {
    const declared = (await readFile(listFile, "utf8"))
      .split("\n")
      .filter(Boolean);
    const extra = requested.filter((c) => !declared.includes(c));
    const unused = declared.filter((c) => !requested.includes(c));
    check(
      extra.length === 0,
      `requested ⊆ declared${extra.length ? `: undeclared ${extra.join(", ")}` : ""}`,
    );
    check(
      unused.length === 0,
      `declared ⊆ requested${unused.length ? `: unused ${unused.join(", ")}` : ""}`,
    );
  }
  if (shots) {
    await mkdir(shots, { recursive: true });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: join(shots, "probe-early.png") });
  }
  const frame = page.frameLocator("iframe");
  const join_ = frame.getByRole("button", { name: /join/i });
  await join_.waitFor({ timeout: 30000 });
  check(true, "reaches the lobby with a Join button");
  if (shots) {
    await mkdir(shots, { recursive: true });
    await page.screenshot({ path: join(shots, "probe-lobby.png") });
  }
  await page.context().close();

  // 2. A bare /addwidget URL: the client appends widgetId + parentUrl only.
  const bare = await open({});
  const text = bare.frameLocator("iframe").locator("body");
  await text.getByText(/does not say which room/).waitFor({ timeout: 30000 });
  const body = await text.innerText();
  check(
    body.includes("/addwidget ") && body.includes("roomId=$matrix_room_id"),
    "bare URL explains the /addwidget line to use",
  );
  check(
    await text.evaluate((b) => b.checkVisibility()),
    "the explanation is visible",
  );
  if (shots) await bare.screenshot({ path: join(shots, "probe-bare.png") });
  await bare.context().close();
} catch (e) {
  check(false, String(e));
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
