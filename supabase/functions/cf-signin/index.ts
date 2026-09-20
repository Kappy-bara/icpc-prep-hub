/**
 * cf-signin: Server-side Codeforces-handle authentication.
 *
 * Replaces the old email magic-link sign-in. The flow:
 *   1. Client verifies CF handle ownership (compile-error challenge, same as before)
 *   2. Client calls this function with { handle, problem, startedAtMs }
 *   3. This function re-checks the submission server-side (so a determined client can't
 *      skip the challenge), then either:
 *      a) RETURNING USER — finds the existing `profiles` row with that verified handle,
 *         generates a magic link for that auth.users row, and returns the session.
 *      b) NEW USER — creates an anonymous auth.users row, sets cf_handle + cf_verified
 *         on the auto-created profiles row, and returns the session.
 *
 * Requires:
 *   - Anonymous sign-ins enabled in Supabase Auth settings
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase)
 *
 * verify_jwt = false (configured in config.toml) — no existing session to verify, this
 * IS the sign-in endpoint.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CF_API = "https://codeforces.com/api";
const WINDOW_MINUTES = 10;
const GRACE_MS = 2 * 60 * 1000;

/** Same matching logic as js/cf-verify.js's matchInSubmissions, server-side. */
function matchInSubmissions(
  submissions: any[],
  handle: string,
  problem: { contestId: number; index: string },
  startedAtMs: number
): boolean {
  const targetHandle = (handle || "").trim().toLowerCase();
  const deadlineMs = startedAtMs + WINDOW_MINUTES * 60 * 1000 + GRACE_MS;
  return submissions.some((sub: any) => {
    if (
      !sub.problem ||
      sub.problem.contestId !== problem.contestId ||
      sub.problem.index !== problem.index
    )
      return false;
    if (sub.verdict !== "COMPILATION_ERROR") return false;
    const subMs = sub.creationTimeSeconds * 1000;
    if (subMs < startedAtMs - GRACE_MS || subMs > deadlineMs) return false;
    if (targetHandle) {
      const members = (sub.author && sub.author.members) || [];
      if (
        !members.some(
          (m: any) => (m.handle || "").toLowerCase() === targetHandle
        )
      )
        return false;
    }
    return true;
  });
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const { handle, problem, startedAtMs } = await req.json();

    if (!handle || !problem || !startedAtMs) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: handle, problem, startedAtMs" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanHandle = handle.trim();

    // --- Step 1: Verify handle exists on Codeforces ---
    const userInfoRes = await fetch(
      `${CF_API}/user.info?handles=${encodeURIComponent(cleanHandle)}`
    );
    if (!userInfoRes.ok) {
      return new Response(
        JSON.stringify({ error: `Codeforces API error: HTTP ${userInfoRes.status}` }),
        { status: 502, headers: corsHeaders }
      );
    }
    const userInfo = await userInfoRes.json();
    if (userInfo.status !== "OK" || !userInfo.result?.length) {
      return new Response(
        JSON.stringify({ error: "That Codeforces handle doesn't exist." }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Use the canonical handle casing from Codeforces
    const canonicalHandle = userInfo.result[0].handle;

    // --- Step 2: Verify ownership via compile-error submission ---
    const statusRes = await fetch(
      `${CF_API}/user.status?handle=${encodeURIComponent(canonicalHandle)}&from=1&count=30`
    );
    if (!statusRes.ok) {
      return new Response(
        JSON.stringify({ error: `Codeforces API error checking submissions: HTTP ${statusRes.status}` }),
        { status: 502, headers: corsHeaders }
      );
    }
    const statusJson = await statusRes.json();
    if (statusJson.status !== "OK") {
      return new Response(
        JSON.stringify({ error: statusJson.comment || "Codeforces API returned an error" }),
        { status: 502, headers: corsHeaders }
      );
    }

    const verified = matchInSubmissions(
      statusJson.result,
      canonicalHandle,
      problem,
      startedAtMs
    );
    if (!verified) {
      return new Response(
        JSON.stringify({
          error: "No matching compile-error submission found. Submit it and try again.",
          retryable: true,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // --- Step 3: Authenticated — find or create account ---
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if this handle already has a verified account
    const { data: existingProfile, error: lookupError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("cf_verified", true)
      .ilike("cf_handle", cleanHandle)
      .maybeSingle();

    if (lookupError) {
      return new Response(
        JSON.stringify({ error: `Database error: ${lookupError.message}` }),
        { status: 500, headers: corsHeaders }
      );
    }

    let userId: string;
    let isReturning = false;

    if (existingProfile) {
      // --- Returning user: generate a magic link to sign them back in ---
      userId = existingProfile.id;
      isReturning = true;

      // Get the user's email (anonymous users get an auto-generated one)
      const { data: userData, error: userError } =
        await supabaseAdmin.auth.admin.getUserById(userId);
      if (userError || !userData?.user) {
        return new Response(
          JSON.stringify({ error: "Couldn't retrieve your account. Please try again." }),
          { status: 500, headers: corsHeaders }
        );
      }

      // Generate a magic link for this user — this creates a session we can return.
      // For anonymous users, we use generateLink with type 'magiclink'. If the user
      // has no email (pure anonymous), we create a temporary one to make this work.
      let email = userData.user.email;
      if (!email) {
        // Anonymous user with no email — assign a deterministic placeholder email
        // based on their user ID so magiclink generation works. This email is never
        // actually sent to; it's just a token the auth system needs.
        email = `${userId}@cf-auth.local`;
        await supabaseAdmin.auth.admin.updateUserById(userId, { email });
      }

      const { data: linkData, error: linkError } =
        await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email,
        });
      if (linkError) {
        return new Response(
          JSON.stringify({ error: `Couldn't generate sign-in: ${linkError.message}` }),
          { status: 500, headers: corsHeaders }
        );
      }

      // Return the token hash and verification type so the client can verify it
      return new Response(
        JSON.stringify({
          type: "magiclink",
          token_hash: linkData.properties?.hashed_token,
          email,
          returning: true,
        }),
        { status: 200, headers: corsHeaders }
      );
    } else {
      // Assign a deterministic email so we can generate a magic link for sign-in
      const email = `${userId || crypto.randomUUID()}@cf-auth.local`;

      // We create the user via admin API so we control the flow entirely server-side.
      const { data: newUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true, // auto-confirm since there's nothing to confirm
          user_metadata: { cf_handle: canonicalHandle },
        });

      if (createError) {
        return new Response(
          JSON.stringify({ error: `Couldn't create account: ${createError.message}` }),
          { status: 500, headers: corsHeaders }
        );
      }

      userId = newUser.user!.id;

      // The handle_new_user trigger already created a blank profiles row.
      // Now set the verified handle on it.
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          cf_handle: canonicalHandle,
          cf_verified: true,
          app_data: {
            version: 5,
            profile: {
              cfHandle: canonicalHandle,
              cfVerified: true,
              gamificationStart: new Date().toISOString().slice(0, 10),
              focusTags: [],
              targetDate: "2026-10-03",
            },
            roadmapProgress: {},
            points: { balance: 0 },
            solvedLog: [],
            cf: {
              ratingHistory: [],
              attemptStats: {},
              unsolvedAttempted: [],
              lastRatingSyncAt: null,
            },
            rewards: [
              { id: "r-youtube", name: "15-minute YouTube break", cost: 15, locked: true },
              { id: "r-treat", name: "A small treat / snack", cost: 20, locked: true },
              { id: "r-afternoon", name: "A guilt-free lazy afternoon", cost: 75, locked: true },
            ],
            redemptions: [],
          },
        })
        .eq("id", userId);

      if (profileError) {
        // Clean up the created auth user if profile setup fails
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return new Response(
          JSON.stringify({ error: `Couldn't set up profile: ${profileError.message}` }),
          { status: 500, headers: corsHeaders }
        );
      }

      // Email is already assigned during creation, no need to update

      // Generate a magic link so the client can establish a session
      const { data: linkData, error: linkError } =
        await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email,
        });

      if (linkError) {
        return new Response(
          JSON.stringify({ error: `Account created but couldn't generate sign-in: ${linkError.message}` }),
          { status: 500, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({
          type: "magiclink",
          token_hash: linkData.properties?.hashed_token,
          email,
          returning: false,
        }),
        { status: 200, headers: corsHeaders }
      );
    }
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message || "Internal error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
