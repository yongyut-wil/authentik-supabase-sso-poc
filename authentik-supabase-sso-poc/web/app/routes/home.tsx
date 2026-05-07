import { redirect, useLoaderData } from "react-router";
import { Form } from "react-router";
import type { Route } from "./+types/home";
import { createSupabaseServerClient } from "../utils/supabase.server";

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw redirect("/auth/login", { headers });
  }

  return { user };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-300 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-green-500/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Navigation */}
      <nav className="bg-slate-900/50 backdrop-blur-xl border-b border-white/5 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-green-400 shadow-inner">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </div>
            <span className="font-bold text-white tracking-tight">Portal</span>
          </div>

          <div className="flex items-center gap-5">
            <div className="flex items-center gap-3 hidden sm:flex">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center">
                <span className="text-xs font-bold text-green-400 uppercase">
                  {user.email?.charAt(0) || 'U'}
                </span>
              </div>
              <span className="text-sm font-medium text-slate-300">{user.email}</span>
            </div>
            <Form action="/auth/logout" method="post">
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold text-slate-300 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all shadow-sm"
              >
                Sign Out
              </button>
            </Form>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Overview</h1>
          <p className="mt-2 text-slate-400">Manage your intelligence dashboard and session details.</p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/5 overflow-hidden">
          <div className="px-6 py-5 border-b border-white/5 flex items-center gap-3 bg-slate-800/30">
            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <h2 className="text-base font-semibold text-white">Authentication Session</h2>
          </div>

          <div className="p-6">
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
              <div className="bg-slate-950/50 rounded-xl p-5 border border-white/5 hover:border-white/10 transition-colors">
                <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-2">User ID</dt>
                <dd className="text-sm font-mono text-slate-300 break-all">{user.id}</dd>
              </div>

              <div className="bg-slate-950/50 rounded-xl p-5 border border-white/5 hover:border-white/10 transition-colors">
                <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-2">Authentication Provider</dt>
                <dd className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 capitalize shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                    {user.app_metadata.provider || 'email'}
                  </span>
                </dd>
              </div>

              <div className="bg-slate-950/50 rounded-xl p-5 border border-white/5 hover:border-white/10 transition-colors md:col-span-2">
                <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-2">Last Sign In Timestamp</dt>
                <dd className="text-sm text-slate-300 font-medium">
                  {new Date(user.last_sign_in_at || '').toLocaleString(undefined, {
                    dateStyle: 'full',
                    timeStyle: 'long'
                  })}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </main>
    </div>
  );
}
