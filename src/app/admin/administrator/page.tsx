import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/auth';
import AdministratorDashboard from './ui';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getAdminUser();
  if (!user) redirect('/admin');
  // Developers can open ministry administration without changing their role.
  if (user.role === 'staff') redirect('/admin/staff/dashboard');
  return <AdministratorDashboard />;
}
