export * from "./generated/api";
import * as zod from "zod";
import { GetCurrentAuthUserResponse } from "./generated/api";
type _AuthUserUnion = zod.infer<typeof GetCurrentAuthUserResponse>["user"];
export type AuthUser = NonNullable<_AuthUserUnion>;
