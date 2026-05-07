import { Form, redirect } from "react-router";
import type { Route } from "./+types/auth.login";
import { createSupabaseServerClient } from "../utils/supabase.server";

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    throw redirect("/", { headers });
  }

  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "sso") {
    const origin = new URL(request.url).origin;

    const { data: oauthData, error } = await supabase.auth.signInWithOAuth({
      provider: "keycloak",
      options: {
        redirectTo: `${origin}/auth/callback`,
        scopes: "openid profile email",
      },
    });

    if (error || !oauthData?.url) {
      return { error: error?.message || "Failed to initiate SSO" };
    }

    let authUrl = oauthData.url;
    try {
      const resp = await fetch(oauthData.url, { redirect: "manual" });
      const location = resp.headers.get("location");

      if (location && location.includes("oidc-proxy")) {
        const { search } = new URL(location);
        const authentikUrl = process.env.AUTHENTIK_AUTHORIZE_URL || "http://localhost:9000/application/o/authorize/";
        authUrl = `${authentikUrl}${search}`;
      }
    } catch (e) {
      console.error("Error fetching oauth url redirect", e);
    }

    throw redirect(authUrl, { headers });
  }

  if (intent === "login") {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: error.message };
    }
    throw redirect("/", { headers });
  }

  if (intent === "register") {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return { error: error.message };
    }
    throw redirect("/", { headers });
  }

  return { error: "Invalid action" };
}

export default function Login({ actionData }: Route.ComponentProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white p-6 rounded-lg shadow border border-gray-100">
        <h1 className="text-xl font-semibold text-center text-gray-900 mb-6">Welcome Back</h1>

        {actionData?.error && (
          <div className="mb-4 p-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-md">
            {actionData.error}
          </div>
        )}

        <Form method="post" className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              name="password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="••••••••"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              name="intent"
              value="login"
              className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Sign In
            </button>
            <button
              type="submit"
              name="intent"
              value="register"
              className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Sign Up
            </button>
          </div>
        </Form>

        <div className="mt-6 mb-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>
        </div>

        <Form method="post">
          <button
            type="submit"
            name="intent"
            value="sso"
            className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
          >
            Login with Authentik SSO
          </button>
        </Form>
      </div>
    </div>
  );
}
