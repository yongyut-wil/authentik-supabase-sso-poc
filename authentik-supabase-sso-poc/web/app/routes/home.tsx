import { redirect, useLoaderData } from "react-router";
import { Form } from "react-router";
import type { Route } from "./+types/home";
import { createSupabaseServerClient } from "../utils/supabase.server";
import { UserCircleIcon, ArrowRightOnRectangleIcon, ServerStackIcon } from "@heroicons/react/24/outline";

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
    <div className="min-h-screen bg-slate-50">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ServerStackIcon className="w-6 h-6 text-indigo-600" />
          <span className="font-bold text-slate-900">App Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-600 hidden sm:block">
            {user.email}
          </span>
          <Form action="/auth/logout" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4 text-slate-500" />
              Sign Out
            </button>
          </Form>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white overflow-hidden shadow-sm shadow-slate-200/50 rounded-2xl border border-slate-100">
          <div className="p-8 sm:p-10">
            <div className="sm:flex sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Welcome Back!</h2>
                <p className="mt-2 text-sm text-slate-500">
                  You have successfully authenticated via Supabase GoTrue.
                </p>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-100 pt-8">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                Session Details
              </h3>

              <div className="mt-4 bg-slate-50 rounded-xl p-6 border border-slate-100 flex items-start gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 inline-block">
                  <UserCircleIcon className="w-8 h-8 text-indigo-500" />
                </div>

                <div className="flex-1">
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                    <div>
                      <dt className="text-xs font-medium text-slate-500 uppercase">User ID</dt>
                      <dd className="mt-1 text-sm text-slate-900 font-mono bg-white px-2 py-1 rounded border border-slate-200 inline-block">
                        {user.id}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500 uppercase">Email Address</dt>
                      <dd className="mt-1 text-sm text-slate-900 font-medium">
                        {user.email}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500 uppercase">Last Sign In</dt>
                      <dd className="mt-1 text-sm text-slate-900">
                        {new Date(user.last_sign_in_at || '').toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500 uppercase">Authentication Provider</dt>
                      <dd className="mt-1 text-sm text-slate-900">
                        <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                          {user.app_metadata.provider || 'email'}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
