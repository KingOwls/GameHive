import { identityHandler } from "../_shared/identity.ts";
Deno.serve(identityHandler(false));
