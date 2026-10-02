import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/auth';
import DeveloperDashboard from './ui';
// Evaluate the signed-in role on each request, never during static generation.
export const dynamic = 'force-dynamic';
export default async function Page(){ const user=await getAdminUser(); if(!user) redirect('/admin'); if(user.role!=='developer') redirect(user.role==='administrator'?'/admin/administrator':'/admin/staff/dashboard'); return <DeveloperDashboard />; }
