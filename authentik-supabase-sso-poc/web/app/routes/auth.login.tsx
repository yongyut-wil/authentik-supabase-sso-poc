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

    // Workaround for oidc-proxy docker internal hostname
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
    // Auto-confirm is enabled, so we can just redirect
    throw redirect("/", { headers });
  }

  return { error: "Invalid action" };
}

export default function Login({ actionData }: Route.ComponentProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center">Login</h1>

        {actionData?.error && (
          <div className="p-3 text-sm text-red-600 bg-red-100 rounded">
            {actionData.error}
          </div>
        )}

        <Form method="post" className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              name="email"
              className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              name="password"
              className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring focus:ring-blue-200"
            />
          </div>
          <div className="flex space-x-2">
            <button
              type="submit"
              name="intent"
              value="login"
              className="w-1/2 px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              Login
            </button>
            <button
              type="submit"
              name="intent"
              value="register"
              className="w-1/2 px-4 py-2 text-white bg-gray-600 rounded hover:bg-gray-700"
            >
              Sign Up
            </button>
          </div>
        </Form>

        <div className="flex items-center justify-center space-x-2">
          <span className="h-px bg-gray-300 w-full"></span>
          <span className="text-gray-500 text-sm">OR</span>
          <span className="h-px bg-gray-300 w-full"></span>
        </div>

        <Form method="post">
          <button
            type="submit"
            name="intent"
            value="sso"
            className="w-full px-4 py-2 font-bold text-white bg-orange-500 rounded hover:bg-orange-600"
          >
            Login with Authentik SSO
          </button>
        </Form>
      </div>
    </div>
  );
}
