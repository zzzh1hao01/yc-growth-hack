/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as chat from "../chat.js";
import type * as contractors from "../contractors.js";
import type * as enrichment from "../enrichment.js";
import type * as leads from "../leads.js";
import type * as lib_exa from "../lib/exa.js";
import type * as lib_fiber from "../lib/fiber.js";
import type * as lib_geo from "../lib/geo.js";
import type * as lib_google from "../lib/google.js";
import type * as lib_openai from "../lib/openai.js";
import type * as lib_orangeslice from "../lib/orangeslice.js";
import type * as lib_orangesliceClient from "../lib/orangesliceClient.js";
import type * as lib_ownerResolution from "../lib/ownerResolution.js";
import type * as lib_personaTraits from "../lib/personaTraits.js";
import type * as lib_scoring from "../lib/scoring.js";
import type * as lib_sfRegions from "../lib/sfRegions.js";
import type * as onboarding from "../onboarding.js";
import type * as persona from "../persona.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  chat: typeof chat;
  contractors: typeof contractors;
  enrichment: typeof enrichment;
  leads: typeof leads;
  "lib/exa": typeof lib_exa;
  "lib/fiber": typeof lib_fiber;
  "lib/geo": typeof lib_geo;
  "lib/google": typeof lib_google;
  "lib/openai": typeof lib_openai;
  "lib/orangeslice": typeof lib_orangeslice;
  "lib/orangesliceClient": typeof lib_orangesliceClient;
  "lib/ownerResolution": typeof lib_ownerResolution;
  "lib/personaTraits": typeof lib_personaTraits;
  "lib/scoring": typeof lib_scoring;
  "lib/sfRegions": typeof lib_sfRegions;
  onboarding: typeof onboarding;
  persona: typeof persona;
  seed: typeof seed;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
