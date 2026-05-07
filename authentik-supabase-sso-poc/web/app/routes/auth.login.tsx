import { Form, redirect } from "react-router";
import type { Route } from "./+types/auth.login";
import { createSupabaseServerClient } from "../utils/supabase.server";
import { LockClosedIcon, ShieldCheckIcon, EnvelopeIcon } from "@heroicons/react/24/outline";

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 mb-4">
            <ShieldCheckIcon className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome Back</h1>
          <p className="mt-2 text-sm text-slate-600">Sign in to your account to continue</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">

          {actionData?.error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-start space-x-3">
              <div className="flex-shrink-0">
                <LockClosedIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-red-800">{actionData.error}</p>
            </div>
          )}

          {/* Local Auth Form */}
          <Form method="post" className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <EnvelopeIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
                </div>
                <input
                  type="email"
                  name="email"
                  required
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors sm:text-sm"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LockClosedIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
                </div>
                <input
                  type="password"
                  name="password"
                  required
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                name="intent"
                value="login"
                className="flex-1 flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
              >
                Sign In
              </button>
              <button
                type="submit"
                name="intent"
                value="register"
                className="flex-1 flex justify-center py-2.5 px-4 border border-slate-200 rounded-xl shadow-sm text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
              >
                Create Account
              </button>
            </div>
          </Form>

          {/* Divider */}
          <div className="mt-8 mb-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-slate-500 font-medium">Or continue with</span>
              </div>
            </div>
          </div>

          {/* SSO Auth Button */}
          <Form method="post">
            <button
              type="submit"
              name="intent"
              value="sso"
              className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all duration-200 hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Login with Authentik SSO
            </button>
          </Form>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-slate-500">
          Secure Single Sign-On provided by Authentik & Supabase POC
        </p>
      </div>
    </div>
  );
}
