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

  if (intent === "sso") {
    const origin = new URL(request.url).origin;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "keycloak",
      options: {
        redirectTo: `${origin}/auth/callback`,
        scopes: "openid profile email",
        skipBrowserRedirect: true,
      },
    });

    if (error || !data?.url) {
      return { error: error?.message || "Failed to initiate SSO" };
    }

    const upstream = await fetch(data.url, { redirect: "manual" });
    const location = upstream.headers.get("location");

    if (!location) {
      return { error: "GoTrue did not return a redirect location" };
    }

    const proxyPrefix = "http://oidc-proxy/protocol/openid-connect/auth";
    const authorizeUrl =
      process.env.AUTHENTIK_AUTHORIZE_URL ||
      "http://localhost:9000/application/o/authorize/";
    const target = location.startsWith(proxyPrefix)
      ? location.replace(proxyPrefix, authorizeUrl)
      : location;

    throw redirect(target, { headers });
  }

  return { error: "Invalid action" };
}

export default function Login({ actionData }: Route.ComponentProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-8 relative z-10">

        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 border border-white/10 text-green-400 mb-5 shadow-inner">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Voice Analysis Portal</h1>
          <p className="mt-2 text-sm text-slate-400">Sign in to access your intelligence dashboard</p>
        </div>

        {/* Error Alert */}
        {actionData?.error && (
          <div className="mb-6 p-4 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium">{actionData.error}</span>
          </div>
        )}

        {/* Local Auth Form */}
        <Form method="post" className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
            <input
              type="email"
              name="email"
              required
              className="w-full px-4 py-2.5 bg-slate-950/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 text-white text-sm transition-all duration-200 placeholder:text-slate-600"
              placeholder="name@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
            <input
              type="password"
              name="password"
              required
              className="w-full px-4 py-2.5 bg-slate-950/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 text-white text-sm transition-all duration-200 placeholder:text-slate-600"
              placeholder="••••••••"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              name="intent"
              value="login"
              className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-950 bg-green-500 hover:bg-green-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-200 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
            >
              Sign In
            </button>
            <button
              type="submit"
              name="intent"
              value="register"
              className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-white/5 border border-white/10 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-200 shadow-sm"
            >
              Create Account
            </button>
          </div>
        </Form>

        {/* Divider */}
        <div className="mt-8 mb-6 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-slate-900 text-slate-400 font-medium rounded-full">Or continue with SSO</span>
          </div>
        </div>

        {/* SSO Button */}
        <Form method="post">
          <button
            type="submit"
            name="intent"
            value="sso"
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-slate-800/80 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-200 shadow-sm border border-white/5"
          >
            <svg className="w-5 h-5 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12c0-5.523-4.477-10-10-10z"/>
            </svg>
            Sign in with Authentik
          </button>
        </Form>
      </div>

      {/* Footer Text */}
      <p className="mt-8 text-center text-xs text-slate-500 font-medium tracking-widest uppercase">
        Secure Enterprise Access
      </p>
    </div>
  );
}
