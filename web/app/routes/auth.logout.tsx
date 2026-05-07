import { redirect } from "react-router";
import type { Route } from "./+types/auth.logout";
import { createSupabaseServerClient } from "../utils/supabase.server";

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);
  await supabase.auth.signOut();

  return redirect("/auth/login", { headers });
}

// In case someone navigates to /auth/logout directly, redirect to home
export async function loader() {
  return redirect("/");
}
