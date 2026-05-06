import { redirect } from "react-router";
import type { Route } from "./+types/auth.callback";
import { createSupabaseServerClient } from "../utils/supabase.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (code) {
    const { supabase, headers } = createSupabaseServerClient(request);

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return redirect(next, { headers });
    }
  }

  // Return the user to an error page with instructions
  return redirect("/auth/login?error=auth-callback-failed");
}
