import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import type { Attendance as AttendanceType, Service, Member, MemberAttendance } from '../types';
import { OperationType } from '../types';
import { Plus, Edit2, Trash2, X, CalendarCheck, Users, Baby, Search, Filter, TrendingUp, BarChart as BarChartIcon, Settings, UserCheck, UserX, User } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  Cell
} from 'recharts';
import { cn } from '../lib/utils';
import { handleDatabaseError, useAuth } from '../App';

export function Attendance() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceType[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberAttendance, setMemberAttendance] = useState<MemberAttendance[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceType | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceFilter, setServiceFilter] = useState('All');
  const [dateRange, setDateRange] = useState({
    start: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });

  // Form state
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    serviceId: '',
    totalCount: 0,
    maleCount: 0,
    femaleCount: 0,
    childrenCount: 0,
  });

  // Service form state
  const [serviceFormData, setServiceFormData] = useState({
    name: '',
    description: '',
  });

  // Member attendance tracking
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [showMemberTracking, setShowMemberTracking] = useState(false);

  useEffect(() => {
    fetchAttendance();
    fetchServices();
    fetchMembers();

    const subscription = supabase
      .channel('attendance-changes')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'attendance' }, () => {
        fetchAttendance();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchAttendance = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('id, date, service_id, total_count, male_count, female_count, children_count, recorded_by, created_at, updated_at')
        .order('date', { ascending: false });
      
      if (error) throw error;
      
      // Fetch services separately and join the data
      if (data && data.length > 0) {
        const { data: servicesData } = await supabase
          .from('services')
          .select('*');
        
        const serviceMap = new Map(servicesData?.map(s => [s.id, s]) || []);
        const enrichedData = data.map(record => ({
          ...record,
          service: serviceMap.get(record.service_id) || null
        }));
        setAttendance(enrichedData);
      } else {
        setAttendance(data || []);
      }
    } catch (error) {
      handleDatabaseError(error, OperationType.LIST, 'attendance');
    }
  };

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      handleDatabaseError(error, OperationType.LIST, 'services');
    }
  };

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('status', 'Active')
        .order('first_name');
      
      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      handleDatabaseError(error, OperationType.LIST, 'members');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.serviceId) {
      handleDatabaseError(
        new Error('Please select a service type'),
        OperationType.CREATE,
        'attendance'
      );
      return;
    }
    
    if (formData.totalCount < 0 || formData.maleCount < 0 || formData.femaleCount < 0 || formData.childrenCount < 0) {
      handleDatabaseError(
        new Error('Attendance counts cannot be negative'),
        OperationType.CREATE,
        'attendance'
      );
      return;
    }
    
    try {
      const data = {
        date: formData.date,
        service_id: formData.serviceId,
        total_count: formData.totalCount,
        male_count: formData.maleCount,
        female_count: formData.femaleCount,
        children_count: formData.childrenCount,
        recorded_by: user?.id,
      };

      let attendanceId: string;

      if (editingRecord) {
        const { error } = await supabase
          .from('attendance')
          .update(data)
          .eq('id', editingRecord.id);
        if (error) throw error;
        attendanceId = editingRecord.id;

        // Delete existing member attendance records
        await supabase
          .from('member_attendance')
          .delete()
          .eq('attendance_id', editingRecord.id);
      } else {
        const { data: newRecord, error } = await supabase
          .from('attendance')
          .insert([data])
          .select()
          .single();
        if (error) throw error;
        attendanceId = newRecord.id;
      }

      // Insert member attendance records
      if (selectedMembers.length > 0) {
        const memberAttendanceData = selectedMembers.map(memberId => ({
          attendance_id: attendanceId,
          member_id: memberId,
          status: 'Present' as const,
          recorded_by: user?.id,
        }));

        const { error } = await supabase
          .from('member_attendance')
          .insert(memberAttendanceData);
        if (error) throw error;
      }

      await fetchAttendance();
      closeModal();
    } catch (error) {
      handleDatabaseError(error, editingRecord ? OperationType.UPDATE : OperationType.CREATE, 'attendance');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await fetchAttendance();
    } catch (error) {
      handleDatabaseError(error, OperationType.DELETE, 'attendance');
    }
  };

  const openModal = async (record?: AttendanceType) => {
    if (record) {
      setEditingRecord(record);
      setFormData({
        date: record.date,
        serviceId: record.service_id,
        totalCount: record.total_count,
        maleCount: record.male_count || 0,
        femaleCount: record.female_count || 0,
        childrenCount: record.children_count || 0,
      });

      // Load member attendance for this record
      try {
        const { data, error } = await supabase
          .from('member_attendance')
          .select('member_id')
          .eq('attendance_id', record.id)
          .eq('status', 'Present');

        if (error) throw error;
        setSelectedMembers(data?.map(ma => ma.member_id) || []);
      } catch (error) {
        console.error('Error loading member attendance:', error);
        setSelectedMembers([]);
      }
    } else {
      setEditingRecord(null);
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        serviceId: services.length > 0 ? services[0].id : '',
        totalCount: 0,
        maleCount: 0,
        femaleCount: 0,
        childrenCount: 0,
      });
      setSelectedMembers([]);
    }
    setIsModalOpen(true);
  };

  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        name: serviceFormData.name,
        description: serviceFormData.description,
      };

      if (editingService) {
        const { error } = await supabase
          .from('services')
          .update(data)
          .eq('id', editingService.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('services')
          .insert([data]);
        if (error) throw error;
      }

      await fetchServices();
      closeServiceModal();
    } catch (error) {
      handleDatabaseError(error, editingService ? OperationType.UPDATE : OperationType.CREATE, 'services');
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this service? This will also delete all associated attendance records.')) return;
    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchServices();
    } catch (error) {
      handleDatabaseError(error, OperationType.DELETE, 'services');
    }
  };

  const openServiceModal = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setServiceFormData({
        name: service.name,
        description: service.description || '',
      });
    } else {
      setEditingService(null);
      setServiceFormData({
        name: '',
        description: '',
      });
    }
    setIsServiceModalOpen(true);
  };

  const closeServiceModal = () => {
    setIsServiceModalOpen(false);
    setEditingService(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
    setSelectedMembers([]);
    setShowMemberTracking(false);
  };

  const filteredAttendance = useMemo(() => {
    return attendance.filter(record => {
      const matchesSearch = record.service?.name.toLowerCase().includes(searchTerm.toLowerCase()) || false;
      const matchesService = serviceFilter === 'All' || record.service?.id === serviceFilter;
      const matchesDate = isWithinInterval(parseISO(record.date), {
        start: parseISO(dateRange.start),
        end: parseISO(dateRange.end)
      });
      return matchesSearch && matchesService && matchesDate;
    });
  }, [attendance, searchTerm, serviceFilter, dateRange]);

  const chartData = useMemo(() => {
    return [...filteredAttendance]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-10)
      .map(r => ({
        date: format(new Date(r.date), 'MMM dd'),
        total: r.total_count,
        children: r.children_count || 0
      }));
  }, [filteredAttendance]);

  const stats = useMemo(() => {
    const total = filteredAttendance.reduce((sum, r) => sum + r.total_count, 0);
    const avg = filteredAttendance.length > 0 ? Math.round(total / filteredAttendance.length) : 0;
    const max = filteredAttendance.length > 0 ? Math.max(...filteredAttendance.map(r => r.total_count)) : 0;
    
    return { total, avg, max };
  }, [filteredAttendance]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Attendance</h1>
          <p className="text-neutral-500">Monitor church service attendance trends</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => openServiceModal()}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-semibold hover:bg-neutral-200 transition-all"
          >
            <Settings size={20} />
            Manage Services
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-all shadow-lg shadow-amber-100"
          >
            <Plus size={20} />
            Record Attendance
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <div className="flex items-center gap-3 text-amber-600 mb-2">
            <Users size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Total Attendance</span>
          </div>
          <h2 className="text-3xl font-bold text-neutral-900">{stats.total.toLocaleString()}</h2>
          <p className="text-xs text-neutral-400 mt-2">For selected period</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <div className="flex items-center gap-3 text-blue-600 mb-2">
            <TrendingUp size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Average per Service</span>
          </div>
          <h2 className="text-3xl font-bold text-neutral-900">{stats.avg.toLocaleString()}</h2>
          <p className="text-xs text-neutral-400 mt-2">Based on {filteredAttendance.length} services</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <div className="flex items-center gap-3 text-purple-600 mb-2">
            <BarChartIcon size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Peak Attendance</span>
          </div>
          <h2 className="text-3xl font-bold text-neutral-900">{stats.max.toLocaleString()}</h2>
          <p className="text-xs text-neutral-400 mt-2">Highest record in period</p>
        </div>
      </div>

      {/* Filters & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 space-y-4">
            <h3 className="font-bold text-neutral-900 flex items-center gap-2">
              <Filter size={18} className="text-neutral-400" />
              Filters
            </h3>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                <input
                  type="text"
                  placeholder="Search service type..."
                  className="w-full pl-10 pr-4 py-2 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-500 uppercase">Service Type</label>
                <select
                  className="w-full px-4 py-2 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                >
                  <option value="All">All Services</option>
                  {services.map(service => (
                    <option key={service.id} value={service.id}>{service.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-500 uppercase">From</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-500 uppercase">To</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <h3 className="text-lg font-bold text-neutral-900 mb-6">Attendance Trends (Last 10 Records)</h3>
          <div className="h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="top" align="right" height={36}/>
                  <Bar name="Total" dataKey="total" fill="#d97706" radius={[4, 4, 0, 0]} />
                  <Bar name="Children" dataKey="children" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-neutral-400">
                No data for selected filters
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
        <div className="p-6 border-b border-neutral-100">
          <h3 className="text-lg font-bold text-neutral-900">Attendance History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Service Type</th>
                <th className="px-6 py-4 font-semibold">Total</th>
                <th className="px-6 py-4 font-semibold">Men/Women/Kids</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredAttendance.map((record) => (
                <tr key={record.id} className="hover:bg-neutral-50 transition-colors group">
                  <td className="px-6 py-4 text-sm text-neutral-600">
                    {format(new Date(record.date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-neutral-900">{record.service?.name || 'Unknown Service'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-amber-600">{record.total_count}</div>
                  </td>
                  <td className="px-6 py-4 text-xs text-neutral-500">
                    {record.male_count || 0}M / {record.female_count || 0}W / {record.children_count || 0}K
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openModal(record)}
                        className="p-2 text-neutral-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      {user?.role === 'admin' && (
                        <button 
                          onClick={() => handleDelete(record.id)}
                          className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAttendance.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-neutral-400">
                    <div className="flex flex-col items-center gap-2">
                      <CalendarCheck size={48} className="text-neutral-100" />
                      <p>No attendance records found for the selected filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-neutral-900">
                {editingRecord ? 'Edit Attendance Record' : 'Record New Attendance'}
              </h2>
              <button onClick={closeModal} className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Date *</label>
                  <input
                    required
                    type="date"
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-amber-500 outline-none"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Service Type *</label>
                  <select
                    required
                    className={cn(
                      "w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-amber-500 outline-none",
                      !formData.serviceId ? "border-red-300" : "border-neutral-200"
                    )}
                    value={formData.serviceId}
                    onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                  >
                    <option value="">Select a service</option>
                    {services.length > 0 ? (
                      services.map(service => (
                        <option key={service.id} value={service.id}>{service.name}</option>
                      ))
                    ) : (
                      <option disabled>No services available</option>
                    )}
                  </select>
                  {!formData.serviceId && <p className="text-xs text-red-600 mt-1">Service is required</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Total Count *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-amber-500 outline-none"
                    value={formData.totalCount}
                    onChange={(e) => setFormData({ ...formData, totalCount: Math.max(0, parseInt(e.target.value)) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Children Count</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-amber-500 outline-none"
                    value={formData.childrenCount}
                    onChange={(e) => setFormData({ ...formData, childrenCount: Math.max(0, parseInt(e.target.value)) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Male Count</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-amber-500 outline-none"
                    value={formData.maleCount}
                    onChange={(e) => setFormData({ ...formData, maleCount: Math.max(0, parseInt(e.target.value)) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Female Count</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-amber-500 outline-none"
                    value={formData.femaleCount}
                    onChange={(e) => setFormData({ ...formData, femaleCount: Math.max(0, parseInt(e.target.value)) })}
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-neutral-700">Track Individual Attendance</label>
                  <button
                    type="button"
                    onClick={() => setShowMemberTracking(!showMemberTracking)}
                    className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                  >
                    {showMemberTracking ? 'Hide' : 'Show'} Member List
                  </button>
                </div>
                
                {showMemberTracking && (
                  <div className="max-h-60 overflow-y-auto border border-neutral-200 rounded-xl p-4 bg-neutral-50">
                    <div className="space-y-2">
                      {members.map(member => (
                        <label key={member.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(member.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMembers([...selectedMembers, member.id]);
                              } else {
                                setSelectedMembers(selectedMembers.filter(id => id !== member.id));
                              }
                            }}
                            className="rounded border-neutral-300 text-amber-600 focus:ring-amber-500"
                          />
                          <div className="flex items-center gap-2">
                            {selectedMembers.includes(member.id) ? (
                              <UserCheck size={16} className="text-green-600" />
                            ) : (
                              <User size={16} className="text-neutral-400" />
                            )}
                            <span className="text-sm font-medium">
                              {member.first_name} {member.last_name}
                            </span>
                            <span className="text-xs text-neutral-500">
                              ({member.gender})
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                    {members.length === 0 && (
                      <p className="text-sm text-neutral-500 text-center py-4">No active members found</p>
                    )}
                  </div>
                )}
              </div>
              
              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 px-6 bg-neutral-100 text-neutral-600 rounded-xl font-semibold hover:bg-neutral-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 px-6 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-colors shadow-lg shadow-amber-100"
                >
                  {editingRecord ? 'Save Changes' : 'Record Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Service Management Modal */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-neutral-900">
                {editingService ? 'Edit Service' : 'Manage Services'}
              </h2>
              <button onClick={closeServiceModal} className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {!editingService ? (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-neutral-900">Available Services</h3>
                    <button
                      onClick={() => openServiceModal()}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition-colors"
                    >
                      <Plus size={16} />
                      Add Service
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {services.map(service => (
                      <div key={service.id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl">
                        <div>
                          <h4 className="font-semibold text-neutral-900">{service.name}</h4>
                          {service.description && (
                            <p className="text-sm text-neutral-600">{service.description}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openServiceModal(service)}
                            className="p-2 text-neutral-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          {user?.role === 'admin' && (
                            <button
                              onClick={() => handleDeleteService(service.id)}
                              className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {services.length === 0 && (
                      <p className="text-center text-neutral-500 py-8">No services found</p>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleServiceSubmit} className="p-6 space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">Service Name *</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-amber-500 outline-none"
                      value={serviceFormData.name}
                      onChange={(e) => setServiceFormData({ ...serviceFormData, name: e.target.value })}
                      placeholder="e.g., Sunday Service"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">Description</label>
                    <textarea
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                      rows={3}
                      value={serviceFormData.description}
                      onChange={(e) => setServiceFormData({ ...serviceFormData, description: e.target.value })}
                      placeholder="Optional description of the service"
                    />
                  </div>
                  
                  <div className="pt-4 flex gap-4">
                    <button
                      type="button"
                      onClick={() => setEditingService(null)}
                      className="flex-1 py-3 px-6 bg-neutral-100 text-neutral-600 rounded-xl font-semibold hover:bg-neutral-200 transition-colors"
                    >
                      Back to List
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 px-6 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-colors shadow-lg shadow-amber-100"
                    >
                      {editingService ? 'Save Changes' : 'Add Service'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
