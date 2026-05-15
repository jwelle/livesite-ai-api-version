import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDemoRequestRoute, type DemoOwnerUser, type GhlLocationConnection } from "./automationRouting";

const users = new Map<string, DemoOwnerUser>([
  ["user-a", { id: "user-a", status: "active" }],
  ["user-b", { id: "user-b", status: "active" }],
  ["inactive-owner", { id: "inactive-owner", status: "suspended" }],
]);

const connections: GhlLocationConnection[] = [
  { id: "conn-a", userId: "user-a", locationId: "loc-a", isActive: true },
  { id: "conn-b", userId: "user-b", locationId: "loc-b", isActive: true },
  { id: "conn-inactive", userId: "user-a", locationId: "loc-inactive", isActive: false },
  { id: "conn-owner-inactive", userId: "inactive-owner", locationId: "loc-owner-inactive", isActive: true },
];

test("missing locationId returns a clear 400", () => {
  const result = resolveDemoRequestRoute({
    auth: { kind: "shared_api_key" },
    locationId: "",
    connections,
    usersById: users,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.equal(result.code, "LOCATION_ID_REQUIRED");
});

test("unknown locationId is rejected", () => {
  const result = resolveDemoRequestRoute({
    auth: { kind: "shared_api_key" },
    locationId: "unknown",
    connections,
    usersById: users,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
  assert.equal(result.code, "GHL_LOCATION_NOT_FOUND");
});

test("inactive GHL connection is rejected", () => {
  const result = resolveDemoRequestRoute({
    auth: { kind: "shared_api_key" },
    locationId: "loc-inactive",
    connections,
    usersById: users,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(result.code, "GHL_LOCATION_INACTIVE");
});

test("shared API key routes ownership from locationId", () => {
  const result = resolveDemoRequestRoute({
    auth: { kind: "shared_api_key" },
    locationId: "loc-b",
    connections,
    usersById: users,
  });

  assert.equal(result.ok, true);
  assert.equal(result.ownerUser.id, "user-b");
  assert.equal(result.connection.id, "conn-b");
});

test("user API key cannot claim another user's locationId", () => {
  const result = resolveDemoRequestRoute({
    auth: { kind: "user_api_key", userId: "user-a" },
    locationId: "loc-b",
    connections,
    usersById: users,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
  assert.equal(result.code, "GHL_LOCATION_NOT_FOUND");
});

test("duplicate active locationIds are rejected", () => {
  const result = resolveDemoRequestRoute({
    auth: { kind: "shared_api_key" },
    locationId: "loc-a",
    connections: [
      ...connections,
      { id: "conn-a-duplicate", userId: "user-a", locationId: "loc-a", isActive: true },
    ],
    usersById: users,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.equal(result.code, "GHL_LOCATION_NOT_UNIQUE");
});
