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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        <p className="mb-6">Welcome, {user.email}!</p>

        <Form action="/auth/logout" method="post">
          <button
            type="submit"
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 w-full"
          >
            Logout
          </button>
        </Form>
      </div>
    </div>
  );
}
