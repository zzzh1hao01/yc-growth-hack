/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agents from "../agents.js";
import type * as batchOwners from "../batchOwners.js";
import type * as chat from "../chat.js";
import type * as contractors from "../contractors.js";
import type * as enrichment from "../enrichment.js";
import type * as http from "../http.js";
import type * as leads from "../leads.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_campaigns from "../lib/campaigns.js";
import type * as lib_coverageHooks from "../lib/coverageHooks.js";
import type * as lib_datasfAssessor from "../lib/datasfAssessor.js";
import type * as lib_enrichmentTypes from "../lib/enrichmentTypes.js";
import type * as lib_exa from "../lib/exa.js";
import type * as lib_fiber from "../lib/fiber.js";
import type * as lib_geo from "../lib/geo.js";
import type * as lib_google from "../lib/google.js";
import type * as lib_httpAuth from "../lib/httpAuth.js";
import type * as lib_openai from "../lib/openai.js";
import type * as lib_orangeslice from "../lib/orangeslice.js";
import type * as lib_orangesliceClient from "../lib/orangesliceClient.js";
import type * as lib_orangesliceSheet from "../lib/orangesliceSheet.js";
import type * as lib_ownerResolution from "../lib/ownerResolution.js";
import type * as lib_personaTraits from "../lib/personaTraits.js";
import type * as lib_playbook from "../lib/playbook.js";
import type * as lib_resolveAgent from "../lib/resolveAgent.js";
import type * as lib_scoring from "../lib/scoring.js";
import type * as lib_sfRegions from "../lib/sfRegions.js";
import type * as lib_slack from "../lib/slack.js";
import type * as onboarding from "../onboarding.js";
import type * as organizations from "../organizations.js";
import type * as outreach from "../outreach.js";
import type * as outreachActions from "../outreachActions.js";
import type * as persona from "../persona.js";
import type * as pipelineConfig from "../pipelineConfig.js";
import type * as seed from "../seed.js";
import type * as slackActions from "../slackActions.js";
import type * as slackData from "../slackData.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agents: typeof agents;
  batchOwners: typeof batchOwners;
  chat: typeof chat;
  contractors: typeof contractors;
  enrichment: typeof enrichment;
  http: typeof http;
  leads: typeof leads;
  "lib/auth": typeof lib_auth;
  "lib/campaigns": typeof lib_campaigns;
  "lib/coverageHooks": typeof lib_coverageHooks;
  "lib/datasfAssessor": typeof lib_datasfAssessor;
  "lib/enrichmentTypes": typeof lib_enrichmentTypes;
  "lib/exa": typeof lib_exa;
  "lib/fiber": typeof lib_fiber;
  "lib/geo": typeof lib_geo;
  "lib/google": typeof lib_google;
  "lib/httpAuth": typeof lib_httpAuth;
  "lib/openai": typeof lib_openai;
  "lib/orangeslice": typeof lib_orangeslice;
  "lib/orangesliceClient": typeof lib_orangesliceClient;
  "lib/orangesliceSheet": typeof lib_orangesliceSheet;
  "lib/ownerResolution": typeof lib_ownerResolution;
  "lib/personaTraits": typeof lib_personaTraits;
  "lib/playbook": typeof lib_playbook;
  "lib/resolveAgent": typeof lib_resolveAgent;
  "lib/scoring": typeof lib_scoring;
  "lib/sfRegions": typeof lib_sfRegions;
  "lib/slack": typeof lib_slack;
  onboarding: typeof onboarding;
  organizations: typeof organizations;
  outreach: typeof outreach;
  outreachActions: typeof outreachActions;
  persona: typeof persona;
  pipelineConfig: typeof pipelineConfig;
  seed: typeof seed;
  slackActions: typeof slackActions;
  slackData: typeof slackData;
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
