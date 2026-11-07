import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { matchPhotoReferences, PHOTO_PROFILES, REFERENCE_PHOTOS } from "../app/lib/photo-references.ts";

test("the included Commons image resolves to its verified aircraft scene", async () => {
  assert.equal(REFERENCE_PHOTOS.length, 1);
  for (const photo of REFERENCE_PHOTOS) {
    const bytes = await readFile(new URL(`../public${photo.image}`, import.meta.url));
    const sha = createHash("sha256").update(bytes).digest("hex");
    assert.equal(sha, photo.sha256, `${photo.key} digest stays in sync with the served asset`);
    const match = matchPhotoReferences(sha, []);
    assert.equal(match?.profile, photo.profile);
    assert.equal(match?.exact, true);
    assert.ok(PHOTO_PROFILES[match.profile].manufacturer);
  }
});

test("an unrelated fingerprint produces no reference match", () => {
  assert.equal(matchPhotoReferences("0".repeat(64), ["f".repeat(32)]), null);
  assert.equal(matchPhotoReferences("0".repeat(64), []), null);
});
