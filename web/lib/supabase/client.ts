import { createBrowserClient } from "@supabase/ssr";

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Implicit flow puts tokens in the URL fragment, which servers (and
        // mail-client "safe link" prefetchers) never see — only this page's
        // own JS reads it. PKCE's ?code=... sits in plain GET-able query
        // params, so a prefetch silently burns the one-time code first.
        flowType: "implicit",
      },
    }
  );
