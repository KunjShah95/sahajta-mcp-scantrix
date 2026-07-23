// AuthGate (src/components/auth/AuthGate.tsx) redirects every visit to "/"
// to either /login or /dashboard before this content is ever shown — see
// its root-redirect logic. This file exists only because App Router
// requires a page.tsx to make "/" a valid route.
export default function RootPage() {
  return null;
}
