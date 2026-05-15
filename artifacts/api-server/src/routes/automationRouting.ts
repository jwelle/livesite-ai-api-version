export type DemoRequestAuth =
  | {
      kind: "user_api_key";
      userId: string;
    }
  | {
      kind: "shared_api_key";
    };

export interface GhlLocationConnection {
  id: string;
  userId: string;
  locationId: string;
  isActive: boolean;
}

export interface DemoOwnerUser {
  id: string;
  status?: string | null;
  tier?: string | null;
  role?: string | null;
}

export type DemoRoutingResult =
  | {
      ok: true;
      ownerUser: DemoOwnerUser;
      connection: GhlLocationConnection;
    }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
    };

export function resolveDemoRequestRoute(input: {
  auth: DemoRequestAuth;
  locationId?: string | null;
  connections: GhlLocationConnection[];
  usersById: Map<string, DemoOwnerUser>;
}): DemoRoutingResult {
  const locationId = input.locationId?.trim();
  if (!locationId) {
    return {
      ok: false,
      status: 400,
      code: "LOCATION_ID_REQUIRED",
      message: "locationId is required.",
    };
  }

  const locationMatches = input.connections.filter((connection) => connection.locationId === locationId);
  let scopedMatches = locationMatches;
  if (input.auth.kind === "user_api_key") {
    const authUserId = input.auth.userId;
    scopedMatches = locationMatches.filter((connection) => connection.userId === authUserId);
  }

  if (scopedMatches.length === 0) {
    return {
      ok: false,
      status: 404,
      code: "GHL_LOCATION_NOT_FOUND",
      message: "No GHL connection found for this locationId.",
    };
  }

  const activeMatches = scopedMatches.filter((connection) => connection.isActive);
  if (activeMatches.length === 0) {
    return {
      ok: false,
      status: 403,
      code: "GHL_LOCATION_INACTIVE",
      message: "The saved GHL connection for this locationId is inactive.",
    };
  }

  if (activeMatches.length > 1) {
    return {
      ok: false,
      status: 409,
      code: "GHL_LOCATION_NOT_UNIQUE",
      message: "Multiple active GHL connections found for this locationId. Remove duplicates before creating demos.",
    };
  }

  const connection = activeMatches[0]!;
  const ownerUser = input.usersById.get(connection.userId);
  if (!ownerUser || ownerUser.status !== "active") {
    return {
      ok: false,
      status: 403,
      code: "GHL_LOCATION_OWNER_INACTIVE",
      message: "The LiveSite account for this locationId is inactive.",
    };
  }

  return {
    ok: true,
    ownerUser,
    connection,
  };
}
