import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Member, Tithe, Attendance, Finance } from '../types';
import { 
  Users, 
  HandCoins, 
  CalendarCheck, 
  TrendingUp, 
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Receipt,
  UserPlus,
  CalendarPlus
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, addDays, setYear, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';
import { Cake } from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function Dashboard() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [tithes, setTithes] = useState<Tithe[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [finances, setFinances] = useState<Finance[]>([]);

  useEffect(() => {
    fetchData();

    const membersSubscription = supabase
      .channel('dashboard-members')
      .on('postgres_changes' as any, { event: '*', table: 'members' }, () => fetchData())
      .subscribe();

    const tithesSubscription = supabase
      .channel('dashboard-tithes')
      .on('postgres_changes' as any, { event: '*', table: 'tithes' }, () => fetchData())
      .subscribe();

    const attendanceSubscription = supabase
      .channel('dashboard-attendance')
      .on('postgres_changes' as any, { event: '*', table: 'attendance' }, () => fetchData())
      .subscribe();

    const financesSubscription = supabase
      .channel('dashboard-finances')
      .on('postgres_changes' as any, { event: '*', table: 'finances' }, () => fetchData())
      .subscribe();

    return () => {
      membersSubscription.unsubscribe();
      tithesSubscription.unsubscribe();
      attendanceSubscription.unsubscribe();
      financesSubscription.unsubscribe();
    };
  }, []);

  const fetchData = async () => {
    const [membersRes, tithesRes, attendanceRes, financesRes] = await Promise.all([
      supabase.from('members').select('*'),
      supabase.from('tithes').select('*'),
      supabase.from('attendance').select('*'),
      supabase.from('finances').select('*')
    ]);

    if (membersRes.data) setMembers(membersRes.data);
    if (tithesRes.data) setTithes(tithesRes.data);
    if (attendanceRes.data) setAttendance(attendanceRes.data);
    if (financesRes.data) setFinances(financesRes.data);
  };

  const totalMembers = members.length;
  const activeMembers = members.filter(m => m.status === 'Active').length;
  
  const currentMonth = format(new Date(), 'yyyy-MM');
  const monthlyTithes = tithes
    .filter(t => t.date.startsWith(currentMonth))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncome = finances
    .filter(f => f.type === 'Income')
    .reduce((sum, f) => sum + f.amount, 0);
  const totalExpense = finances
    .filter(f => f.type === 'Expense')
    .reduce((sum, f) => sum + f.amount, 0);
  const balance = totalIncome - totalExpense;

  const lastAttendance = attendance.sort((a, b) => b.date.localeCompare(a.date))[0]?.total_count || 0;

  // Upcoming Birthdays
  const today = new Date();
  const nextWeek = addDays(today, 7);
  const upcomingBirthdays = members.filter(m => {
    if (!m.birthday) return false;
    try {
      const bday = new Date(m.birthday);
      const thisYearBday = setYear(bday, today.getFullYear());
      const nextBday = thisYearBday < startOfDay(today) ? setYear(bday, today.getFullYear() + 1) : thisYearBday;
      return isWithinInterval(nextBday, { start: startOfDay(today), end: endOfDay(nextWeek) });
    } catch (e) {
      return false;
    }
  }).sort((a, b) => {
    const bdayA = new Date(a.birthday!);
    const bdayB = new Date(b.birthday!);
    const nextA = setYear(bdayA, today.getFullYear()) < startOfDay(today) ? setYear(bdayA, today.getFullYear() + 1) : setYear(bdayA, today.getFullYear());
    const nextB = setYear(bdayB, today.getFullYear()) < startOfDay(today) ? setYear(bdayB, today.getFullYear() + 1) : setYear(bdayB, today.getFullYear());
    return nextA.getTime() - nextB.getTime();
  });

  // Chart Data
  const last6Months = Array.from({ length: 6 }).map((_, i) => {
    const d = subMonths(new Date(), 5 - i);
    const monthStr = format(d, 'yyyy-MM');
    const monthName = format(d, 'MMM');
    const monthTithes = tithes
      .filter(t => t.date.startsWith(monthStr))
      .reduce((sum, t) => sum + t.amount, 0);
    const monthFinances = finances
      .filter(f => f.date.startsWith(monthStr));
    const income = monthFinances.filter(f => f.type === 'Income').reduce((sum, f) => sum + f.amount, 0);
    const expense = monthFinances.filter(f => f.type === 'Expense').reduce((sum, f) => sum + f.amount, 0);
    
    return { name: monthName, tithes: monthTithes, income, expense };
  });

  const attendanceTrend = attendance
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7)
    .map(a => ({
      date: format(new Date(a.date), 'MMM dd'),
      total: a.total_count,
      children: a.children_count
    }));

  const stats = [
    { name: 'Total Members', value: totalMembers, icon: Users, color: 'bg-blue-500', trend: `${activeMembers} Active` },
    { name: "This Month's Tithes", value: `GH₵ ${monthlyTithes.toLocaleString()}`, icon: HandCoins, color: 'bg-emerald-500', trend: 'This Month' },
    { name: 'Last Attendance', value: lastAttendance, icon: CalendarCheck, color: 'bg-amber-500', trend: 'Latest Service' },
    { name: 'Church Balance', value: `GH₵ ${balance.toLocaleString()}`, icon: TrendingUp, color: 'bg-purple-500', trend: 'Net Total' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Dashboard</h1>
        <p className="text-neutral-500">Welcome to Greater Works City Church Management System</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.color} p-3 rounded-xl text-white`}>
                <stat.icon size={24} />
              </div>
              <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">{stat.name}</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-neutral-900">{stat.value}</div>
              <div className="text-sm text-neutral-500 mt-1">{stat.trend}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
        <h3 className="text-lg font-bold text-neutral-900 mb-6">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button 
            onClick={() => navigate('/members')}
            className="flex flex-col items-center gap-3 p-4 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all group"
          >
            <div className="p-3 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform">
              <UserPlus size={24} />
            </div>
            <span className="text-sm font-bold">Add Member</span>
          </button>
          <button 
            onClick={() => navigate('/tithes')}
            className="flex flex-col items-center gap-3 p-4 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all group"
          >
            <div className="p-3 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform">
              <HandCoins size={24} />
            </div>
            <span className="text-sm font-bold">Record Tithe</span>
          </button>
          <button 
            onClick={() => navigate('/attendance')}
            className="flex flex-col items-center gap-3 p-4 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all group"
          >
            <div className="p-3 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform">
              <CalendarPlus size={24} />
            </div>
            <span className="text-sm font-bold">Mark Attendance</span>
          </button>
          <button 
            onClick={() => navigate('/finances')}
            className="flex flex-col items-center gap-3 p-4 rounded-xl bg-purple-50 text-purple-600 hover:bg-purple-100 transition-all group"
          >
            <div className="p-3 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform">
              <Receipt size={24} />
            </div>
            <span className="text-sm font-bold">New Expense</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Tithes Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <h3 className="text-lg font-bold text-neutral-900 mb-6">Tithes Overview (Last 6 Months)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last6Months}>
                <defs>
                  <linearGradient id="colorTithes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="tithes" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTithes)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Finances Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <h3 className="text-lg font-bold text-neutral-900 mb-6">Income vs Expenses</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last6Months}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="income" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attendance Trend */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <h3 className="text-lg font-bold text-neutral-900 mb-6">Attendance Trend (Last 7 Services)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b' }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="children" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#3b82f6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Members */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
          <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-neutral-900">Recently Joined</h3>
            <button className="text-sm text-primary-600 font-semibold hover:underline">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Name</th>
                  <th className="px-6 py-4 font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {members.slice(0, 5).map((member) => (
                  <tr key={member.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-neutral-900">{member.first_name} {member.last_name}</div>
                      <div className="text-xs text-neutral-500">{member.gender}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600">
                      {member.date_joined ? format(new Date(member.date_joined), 'MMM dd, yyyy') : 'N/A'}
                    </td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-6 py-10 text-center text-neutral-400">
                      No members found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Upcoming Birthdays */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
          <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
              <Cake size={20} className="text-pink-500" />
              Upcoming Birthdays
            </h3>
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Next 7 Days</span>
          </div>
          <div className="p-6">
            {upcomingBirthdays.length > 0 ? (
              <div className="space-y-4">
                {upcomingBirthdays.map((member) => {
                  const bday = new Date(member.birthday!);
                  const isToday = format(bday, 'MM-dd') === format(new Date(), 'MM-dd');
                  return (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center font-bold">
                          {member.first_name[0]}{member.last_name[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-neutral-900">{member.first_name} {member.last_name}</div>
                          <div className="text-xs text-neutral-500">{member.phone_number || 'No phone'}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={cn(
                          "text-sm font-bold",
                          isToday ? "text-pink-600" : "text-neutral-900"
                        )}>
                          {isToday ? 'Today! 🎂' : format(bday, 'MMM dd')}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {isToday ? 'Happy Birthday!' : 'Coming up'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-neutral-400">
                <Cake size={40} className="text-neutral-100 mb-2" />
                <p>No birthdays in the next 7 days.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
