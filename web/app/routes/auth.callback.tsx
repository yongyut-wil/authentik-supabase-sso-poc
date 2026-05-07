import { redirect } from "react-router";
import type { Route } from "./+types/auth.callback";
import { createSupabaseServerClient } from "../utils/supabase.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const idpError = url.searchParams.get("error");
  const idpErrorDescription = url.searchParams.get("error_description");
  const next = url.searchParams.get("next") ?? "/";

  if (idpError) {
    console.error("[auth.callback] IdP returned error", idpError, idpErrorDescription);
    return redirect(`/auth/login?error=${encodeURIComponent(idpErrorDescription || idpError)}`);
  }

  if (!code) {
    console.error("[auth.callback] No code in callback URL", url.search);
    return redirect("/auth/login?error=missing-code");
  }

  const { supabase, headers } = createSupabaseServerClient(request);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth.callback] exchangeCodeForSession failed", error);
    return redirect(`/auth/login?error=${encodeURIComponent(error.message)}`);
  }

  return redirect(next, { headers });
}
