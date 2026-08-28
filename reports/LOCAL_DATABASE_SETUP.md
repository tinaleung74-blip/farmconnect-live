# Local database setup

The browser no longer silently falls back to the production database.

In `.env.local`, add the following using the **isolated test project's** values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_TEST_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_TEST_PROJECT_PUBLIC_KEY
```

Do not use the service-role key for either public variable. Restart the development server after editing. Production must have its own matching variables configured before building.

Localhost blocks non-read requests to the known production project, except login/logout. This also blocks read-only POST RPCs and private-file signing on that project; it is deliberately conservative. This is an accident guard, not a substitute for database permissions or full isolation.

No environment secrets were changed by this fix. The user must supply a real isolated project to run write-flow tests.
