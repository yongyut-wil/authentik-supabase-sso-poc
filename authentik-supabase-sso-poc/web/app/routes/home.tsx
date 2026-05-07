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
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </div>
            <span className="font-bold text-slate-900 tracking-tight">Portal</span>
          </div>

          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2 hidden sm:flex">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <span className="text-xs font-bold text-slate-600 uppercase">
                  {user.email?.charAt(0) || 'U'}
                </span>
              </div>
              <span className="text-sm font-medium text-slate-700">{user.email}</span>
            </div>
            <Form action="/auth/logout" method="post">
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all shadow-sm"
              >
                Sign Out
              </button>
            </Form>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Overview</h1>
          <p className="mt-2 text-slate-500">Manage your account and view session details.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <h2 className="text-base font-semibold text-slate-900">Authentication Session</h2>
          </div>

          <div className="p-6">
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-2">User ID</dt>
                <dd className="text-sm font-mono text-slate-900 break-all">{user.id}</dd>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-2">Authentication Provider</dt>
                <dd className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                    {user.app_metadata.provider || 'email'}
                  </span>
                </dd>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 md:col-span-2">
                <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-2">Last Sign In Timestamp</dt>
                <dd className="text-sm text-slate-900 font-medium">
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
