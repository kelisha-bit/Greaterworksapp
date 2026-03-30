import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { Finance, Tithe, OperationType, Attendance } from '../types';
import { 
  FileText, 
  Download, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  Filter,
  Tag,
  Users,
  LineChart as LineChartIcon
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { cn } from '../lib/utils';
import { handleDatabaseError, useAuth } from '../App';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export function Reports() {
  const { user } = useAuth();
  const [finances, setFinances] = useState<Finance[]>([]);
  const [tithes, setTithes] = useState<Tithe[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  useEffect(() => {
    fetchData();

    const financesSubscription = supabase
      .channel('reports-finances')
      .on('postgres_changes' as any, { event: '*', table: 'finances' }, () => fetchData())
      .subscribe();

    const tithesSubscription = supabase
      .channel('reports-tithes')
      .on('postgres_changes' as any, { event: '*', table: 'tithes' }, () => fetchData())
      .subscribe();

    const attendanceSubscription = supabase
      .channel('reports-attendance')
      .on('postgres_changes' as any, { event: '*', table: 'attendance' }, () => fetchData())
      .subscribe();

    return () => {
      financesSubscription.unsubscribe();
      tithesSubscription.unsubscribe();
      attendanceSubscription.unsubscribe();
    };
  }, []);

  const fetchData = async () => {
    try {
      const [financesRes, tithesRes, attendanceRes] = await Promise.all([
        supabase.from('finances').select('*').order('date', { ascending: false }),
        supabase.from('tithes').select('*'),
        supabase.from('attendance').select('*').order('date', { ascending: true })
      ]);

      if (financesRes.error) throw financesRes.error;
      if (tithesRes.error) throw tithesRes.error;
      if (attendanceRes.error) throw attendanceRes.error;

      setFinances(financesRes.data || []);
      setTithes(tithesRes.data || []);
      setAttendance(attendanceRes.data || []);
    } catch (error) {
      handleDatabaseError(error, OperationType.LIST, 'reports');
    }
  };

  const categories = useMemo(() => {
    const cats = new Set<string>();
    finances.forEach(f => cats.add(f.category));
    if (tithes.length > 0) cats.add('Tithe');
    return Array.from(cats).sort();
  }, [finances, tithes]);

  const filteredData = useMemo(() => {
    const start = parseISO(dateRange.start);
    const end = parseISO(dateRange.end);

    const filteredFinances = finances.filter(f => {
      const date = parseISO(f.date);
      const inInterval = isWithinInterval(date, { start, end });
      const matchesType = typeFilter === 'All' || f.type === typeFilter;
      const matchesCategory = categoryFilter === 'All' || f.category === categoryFilter;
      return inInterval && matchesType && matchesCategory;
    });

    const filteredTithes = tithes.filter(t => {
      const date = parseISO(t.date);
      const inInterval = isWithinInterval(date, { start, end });
      const matchesType = typeFilter === 'All' || typeFilter === 'Income';
      const matchesCategory = categoryFilter === 'All' || categoryFilter === 'Tithe';
      return inInterval && matchesType && matchesCategory;
    });

    const filteredAttendance = attendance.filter(a => {
      const date = parseISO(a.date);
      return isWithinInterval(date, { start, end });
    });

    return { finances: filteredFinances, tithes: filteredTithes, attendance: filteredAttendance };
  }, [finances, tithes, attendance, dateRange, typeFilter, categoryFilter]);

  const stats = useMemo(() => {
    const titheIncome = filteredData.tithes.reduce((sum, t) => sum + t.amount, 0);
    const otherIncome = filteredData.finances
      .filter(f => f.type === 'Income')
      .reduce((sum, f) => sum + f.amount, 0);
    
    const totalIncome = titheIncome + otherIncome;
    const totalExpense = filteredData.finances
      .filter(f => f.type === 'Expense')
      .reduce((sum, f) => sum + f.amount, 0);
    
    const avgAttendance = filteredData.attendance.length > 0
      ? Math.round(filteredData.attendance.reduce((sum, a) => sum + a.total_count, 0) / filteredData.attendance.length)
      : 0;
    
    return {
      totalIncome,
      totalExpense,
      net: totalIncome - totalExpense,
      titheIncome,
      otherIncome,
      avgAttendance
    };
  }, [filteredData]);

  const expenseCategoryData = useMemo(() => {
    const categories: { [key: string]: number } = {};
    
    filteredData.finances
      .filter(f => f.type === 'Expense')
      .forEach(f => {
        categories[f.category] = (categories[f.category] || 0) + f.amount;
      });

    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const incomeCategoryData = useMemo(() => {
    const categories: { [key: string]: number } = {};
    
    // Add tithes
    if (filteredData.tithes.length > 0) {
      categories['Tithe'] = filteredData.tithes.reduce((sum, t) => sum + t.amount, 0);
    }

    // Add other income
    filteredData.finances
      .filter(f => f.type === 'Income')
      .forEach(f => {
        categories[f.category] = (categories[f.category] || 0) + f.amount;
      });

    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const attendanceTrendData = useMemo(() => {
    return filteredData.attendance.map(a => ({
      date: format(parseISO(a.date), 'MMM dd'),
      count: a.total_count,
      type: a.service_type
    }));
  }, [filteredData]);

  const attendanceCompositionData = useMemo(() => {
    let male = 0;
    let female = 0;
    let children = 0;

    filteredData.attendance.forEach(a => {
      male += a.male_count || 0;
      female += a.female_count || 0;
      children += a.children_count || 0;
    });

    if (male === 0 && female === 0 && children === 0) return [];

    return [
      { name: 'Men', value: male, color: '#3b82f6' },
      { name: 'Women', value: female, color: '#ec4899' },
      { name: 'Children', value: children, color: '#f59e0b' },
    ];
  }, [filteredData]);

  const attendanceByTypeData = useMemo(() => {
    const types: { [key: string]: number } = {};
    filteredData.attendance.forEach(a => {
      types[a.service_type] = (types[a.service_type] || 0) + a.total_count;
    });
    return Object.entries(types).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const incomeVsExpenseData = useMemo(() => {
    return [
      { name: 'Income', value: stats.totalIncome, color: '#10b981' },
      { name: 'Expense', value: stats.totalExpense, color: '#ef4444' },
    ];
  }, [stats]);

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Category', 'Description', 'Amount'];
    const rows = [
      ...filteredData.finances.map(f => [f.date, f.type, f.category, f.description, f.amount]),
      ...filteredData.tithes.map(t => [t.date, 'Income', 'Tithe', `Tithe from ${t.member_name}`, t.amount])
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `financial_report_${dateRange.start}_to_${dateRange.end}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Financial Reports</h1>
          <p className="text-neutral-500">Generate and export detailed financial insights</p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-neutral-800 transition-all shadow-lg"
        >
          <Download size={20} />
          Export CSV
        </button>
      </div>

      {/* Date Range & Filters Selector */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 space-y-6">
        <div className="flex flex-col md:flex-row items-end gap-6">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
              <Calendar size={16} /> Start Date
            </label>
            <input
              type="date"
              className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
              <Calendar size={16} /> End Date
            </label>
            <input
              type="date"
              className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </div>
          <div className="hidden md:block pb-1">
            <div className="h-10 w-px bg-neutral-200 mx-4"></div>
          </div>
          <div className="flex-1 text-center md:text-left">
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">Period Selected</p>
            <p className="text-sm font-semibold text-neutral-700">
              {format(parseISO(dateRange.start), 'MMM dd, yyyy')} - {format(parseISO(dateRange.end), 'MMM dd, yyyy')}
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 border-t border-neutral-50 pt-6">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
              <Filter size={16} /> Transaction Type
            </label>
            <select
              className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCategoryFilter('All'); // Reset category when type changes to avoid invalid combinations
              }}
            >
              <option value="All">All Types</option>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
            </select>
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
              <Tag size={16} /> Category
            </label>
            <select
              className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="All">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 hidden md:block"></div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <div className="flex items-center gap-3 text-emerald-600 mb-2">
            <TrendingUp size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Total Income</span>
          </div>
          <h2 className="text-3xl font-bold text-neutral-900">GH₵ {stats.totalIncome.toLocaleString()}</h2>
          <p className="text-xs text-neutral-400 mt-2">Tithes: GH₵ {stats.titheIncome.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <div className="flex items-center gap-3 text-red-600 mb-2">
            <TrendingDown size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Total Expenses</span>
          </div>
          <h2 className="text-3xl font-bold text-neutral-900">GH₵ {stats.totalExpense.toLocaleString()}</h2>
          <p className="text-xs text-neutral-400 mt-2">Other Income: GH₵ {stats.otherIncome.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <div className="flex items-center gap-3 text-primary-600 mb-2">
            <Wallet size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Net Balance</span>
          </div>
          <h2 className="text-3xl font-bold text-neutral-900">GH₵ {stats.net.toLocaleString()}</h2>
          <p className="text-xs text-neutral-400 mt-2">For selected period</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <div className="flex items-center gap-3 text-purple-600 mb-2">
            <Users size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Avg Attendance</span>
          </div>
          <h2 className="text-3xl font-bold text-neutral-900">{stats.avgAttendance.toLocaleString()}</h2>
          <p className="text-xs text-neutral-400 mt-2">Per service</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Income by Category Pie Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <div className="flex items-center gap-2 mb-6">
            <PieChartIcon size={20} className="text-emerald-500" />
            <h3 className="text-lg font-bold text-neutral-900">Income by Category</h3>
          </div>
          <div className="h-[350px]">
            {incomeCategoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={incomeCategoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {incomeCategoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => `GH₵ ${value.toLocaleString()}`}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-neutral-400">
                No income data for this period
              </div>
            )}
          </div>
        </div>

        {/* Category Spending Pie Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <div className="flex items-center gap-2 mb-6">
            <PieChartIcon size={20} className="text-red-500" />
            <h3 className="text-lg font-bold text-neutral-900">Expense by Category</h3>
          </div>
          <div className="h-[350px]">
            {expenseCategoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseCategoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {expenseCategoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => `GH₵ ${value.toLocaleString()}`}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-neutral-400">
                No expense data for this period
              </div>
            )}
          </div>
        </div>

        {/* Attendance Composition Pie Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <div className="flex items-center gap-2 mb-6">
            <Users size={20} className="text-blue-500" />
            <h3 className="text-lg font-bold text-neutral-900">Attendance Composition</h3>
          </div>
          <div className="h-[350px]">
            {attendanceCompositionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={attendanceCompositionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {attendanceCompositionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-neutral-400">
                No composition data available
              </div>
            )}
          </div>
        </div>

        {/* Attendance by Service Type Bar Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <div className="flex items-center gap-2 mb-6">
            <BarChartIcon size={20} className="text-purple-500" />
            <h3 className="text-lg font-bold text-neutral-900">Attendance by Service Type</h3>
          </div>
          <div className="h-[350px]">
            {attendanceByTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceByTypeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} width={120} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-neutral-400">
                No service type data available
              </div>
            )}
          </div>
        </div>

        {/* Attendance Trend Line Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <LineChartIcon size={20} className="text-purple-500" />
            <h3 className="text-lg font-bold text-neutral-900">Attendance Trends</h3>
          </div>
          <div className="h-[350px]">
            {attendanceTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendanceTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36}/>
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    name="Total Attendance"
                    stroke="#8b5cf6" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-neutral-400">
                No attendance data for this period
              </div>
            )}
          </div>
        </div>

        {/* Income vs Expense Bar Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <BarChartIcon size={20} className="text-neutral-400" />
            <h3 className="text-lg font-bold text-neutral-900">Income vs Expense Summary</h3>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeVsExpenseData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => `GH₵ ${value.toLocaleString()}`}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {incomeVsExpenseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Income Categories Table */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 lg:col-span-1">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp size={20} className="text-emerald-500" />
            <h3 className="text-lg font-bold text-neutral-900">Top Income Sources</h3>
          </div>
          <div className="space-y-4">
            {incomeCategoryData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-sm font-medium text-neutral-700">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-neutral-900">GH₵ {item.value.toLocaleString()}</span>
              </div>
            ))}
            {incomeCategoryData.length === 0 && (
              <p className="text-sm text-neutral-400 text-center py-4">No income data</p>
            )}
          </div>
        </div>

        {/* Top Expense Categories Table */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 lg:col-span-1">
          <div className="flex items-center gap-2 mb-6">
            <TrendingDown size={20} className="text-red-500" />
            <h3 className="text-lg font-bold text-neutral-900">Top Expense Categories</h3>
          </div>
          <div className="space-y-4">
            {expenseCategoryData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-sm font-medium text-neutral-700">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-neutral-900">GH₵ {item.value.toLocaleString()}</span>
              </div>
            ))}
            {expenseCategoryData.length === 0 && (
              <p className="text-sm text-neutral-400 text-center py-4">No expense data</p>
            )}
          </div>
        </div>

        {/* Attendance Summary Table */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 lg:col-span-1">
          <div className="flex items-center gap-2 mb-6">
            <Users size={20} className="text-purple-500" />
            <h3 className="text-lg font-bold text-neutral-900">Attendance Summary</h3>
          </div>
          <div className="space-y-4">
            {attendanceByTypeData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <span className="text-sm font-medium text-neutral-700">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-neutral-900">{item.value.toLocaleString()}</span>
              </div>
            ))}
            {attendanceByTypeData.length === 0 && (
              <p className="text-sm text-neutral-400 text-center py-4">No attendance data</p>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Attendance List */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
        <div className="p-6 border-b border-neutral-100">
          <h3 className="text-lg font-bold text-neutral-900">Attendance Records</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Service Type</th>
                <th className="px-6 py-4 font-semibold text-center">Men</th>
                <th className="px-6 py-4 font-semibold text-center">Women</th>
                <th className="px-6 py-4 font-semibold text-center">Children</th>
                <th className="px-6 py-4 font-semibold text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredData.attendance.sort((a, b) => b.date.localeCompare(a.date)).map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-neutral-600">
                    {format(parseISO(item.date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700">
                      {item.service_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-center text-neutral-600">
                    {item.male_count || 0}
                  </td>
                  <td className="px-6 py-4 text-sm text-center text-neutral-600">
                    {item.female_count || 0}
                  </td>
                  <td className="px-6 py-4 text-sm text-center text-neutral-600">
                    {item.children_count || 0}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-bold text-neutral-900">
                      {item.total_count.toLocaleString()}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredData.attendance.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-neutral-400">
                    No attendance records found for the selected period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Transaction List for Period */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
        <div className="p-6 border-b border-neutral-100">
          <h3 className="text-lg font-bold text-neutral-900">Detailed Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Description</th>
                <th className="px-6 py-4 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {[
                ...filteredData.finances,
                ...filteredData.tithes.map(t => ({
                  id: t.id,
                  date: t.date,
                  type: 'Income' as const,
                  category: 'Tithe',
                  description: `Tithe from ${t.member_name}`,
                  amount: t.amount
                }))
              ].sort((a, b) => b.date.localeCompare(a.date)).map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-neutral-600">
                    {format(parseISO(item.date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      item.type === 'Income' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    )}>
                      {item.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-neutral-900">
                    {item.category}
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-500 truncate max-w-[200px]">
                    {item.description}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={cn(
                      "font-bold",
                      item.type === 'Income' ? "text-emerald-600" : "text-red-600"
                    )}>
                      GH₵ {item.amount.toLocaleString()}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredData.finances.length === 0 && filteredData.tithes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-neutral-400">
                    No transactions found for the selected period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
