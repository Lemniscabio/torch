// Route-group layout that gates every page nested inside it.
// AppShell is a client component that reads the AuthProvider and either
// redirects to /login or renders TopNav + the child page.

import { AppShell } from '@/components/shell/AppShell';

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
