import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders the photo reference catalog in the production page", async () => {
  const html = await readFile(new URL("../.next/server/app/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>SkyTrace Live/);
  assert.match(html, /Airbus A320 reference photo/);
  assert.match(html, /Airbus A320-214, MSN 5098/);
});
