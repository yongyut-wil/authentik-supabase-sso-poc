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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between">
        <div className="font-semibold text-gray-900">Dashboard</div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user.email}</span>
          <Form action="/auth/logout" method="post">
            <button
              type="submit"
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Sign Out
            </button>
          </Form>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Session Information</h2>
            <p className="mt-1 text-sm text-gray-500">Details about your current authentication session.</p>
          </div>

          <div className="p-6">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
              <div>
                <dt className="text-sm font-medium text-gray-500">User ID</dt>
                <dd className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 p-1.5 rounded inline-block">
                  {user.id}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Provider</dt>
                <dd className="mt-1 text-sm text-gray-900 capitalize">
                  {user.app_metadata.provider || 'email'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Sign In</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(user.last_sign_in_at || '').toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </main>
    </div>
  );
}
