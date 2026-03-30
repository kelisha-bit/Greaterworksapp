import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { ChurchEvent, OperationType } from '../types';
import { Plus, Search, MoreVertical, Edit2, Trash2, X, Calendar, Clock, MapPin, User, Tag, Info, Filter, ChevronRight, LayoutGrid, Calendar as CalendarIcon, ChevronLeft, AlertCircle, Repeat } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, differenceInDays, differenceInMonths, differenceInYears } from 'date-fns';
import { cn } from '../lib/utils';
import { handleDatabaseError, useAuth } from '../App';
import { toast } from 'sonner';

export function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<ChurchEvent | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '10:00',
    location: '',
    category: 'Service' as ChurchEvent['category'],
    status: 'Upcoming' as ChurchEvent['status'],
    organizer: '',
    recurrence_type: 'None' as ChurchEvent['recurrence_type'],
    recurrence_interval: 1,
    recurrence_end_date: '',
  });

  useEffect(() => {
    fetchEvents();

    const subscription = supabase
      .channel('events-changes')
      .on('postgres_changes' as any, { event: '*', table: 'events' }, () => {
        fetchEvents();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });
      
      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      handleDatabaseError(error, OperationType.LIST, 'events');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const eventData = {
        title: formData.title,
        description: formData.description,
        date: formData.date,
        time: formData.time,
        location: formData.location,
        category: formData.category,
        status: formData.status,
        organizer: formData.organizer,
        recurrence_type: formData.recurrence_type,
        recurrence_interval: formData.recurrence_interval,
        recurrence_end_date: formData.recurrence_end_date || null,
      };

      if (editingEvent) {
        const { error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', editingEvent.id);
        if (error) throw error;
        toast.success('Event updated successfully');
      } else {
        const { error } = await supabase
          .from('events')
          .insert([eventData]);
        if (error) throw error;
        toast.success('Event created successfully');
      }
      closeModal();
    } catch (error) {
      handleDatabaseError(error, editingEvent ? OperationType.UPDATE : OperationType.CREATE, 'events');
    }
  };

  const handleDelete = async () => {
    if (!eventToDelete) return;
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventToDelete);
      if (error) throw error;
      toast.success('Event deleted successfully');
      setIsDeleteModalOpen(false);
      setEventToDelete(null);
    } catch (error) {
      handleDatabaseError(error, OperationType.DELETE, 'events');
    }
  };

  const openModal = (event: ChurchEvent | null = null, initialDate?: string) => {
    if (event) {
      setEditingEvent(event);
      setFormData({
        title: event.title,
        description: event.description || '',
        date: event.date,
        time: event.time,
        location: event.location || '',
        category: event.category,
        status: event.status,
        organizer: event.organizer || '',
        recurrence_type: event.recurrence_type || 'None',
        recurrence_interval: event.recurrence_interval || 1,
        recurrence_end_date: event.recurrence_end_date || '',
      });
    } else {
      setEditingEvent(null);
      setFormData({
        title: '',
        description: '',
        date: initialDate || format(new Date(), 'yyyy-MM-dd'),
        time: '10:00',
        location: '',
        category: 'Service',
        status: 'Upcoming',
        organizer: '',
        recurrence_type: 'None',
        recurrence_interval: 1,
        recurrence_end_date: '',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
  };

  const isEventOnDay = (event: ChurchEvent, day: Date) => {
    const eventDate = parseISO(event.date);
    if (isSameDay(eventDate, day)) return true;
    
    if (event.recurrence_type === 'None' || !event.recurrence_type) return false;
    
    // Check if day is before event start date
    if (day < eventDate) return false;
    
    // Check if day is after recurrence end date
    if (event.recurrence_end_date && day > parseISO(event.recurrence_end_date)) return false;
    
    const interval = event.recurrence_interval || 1;
    
    switch (event.recurrence_type) {
      case 'Daily': {
        const diff = differenceInDays(day, eventDate);
        return diff % interval === 0;
      }
      case 'Weekly': {
        const diff = differenceInDays(day, eventDate);
        return diff % (7 * interval) === 0;
      }
      case 'Monthly': {
        if (day.getDate() !== eventDate.getDate()) return false;
        const diff = differenceInMonths(day, eventDate);
        return diff >= 0 && diff % interval === 0;
      }
      case 'Yearly': {
        if (day.getDate() !== eventDate.getDate() || day.getMonth() !== eventDate.getMonth()) return false;
        const diff = differenceInYears(day, eventDate);
        return diff >= 0 && diff % interval === 0;
      }
      default:
        return false;
    }
  };

  const filteredEvents = events.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          e.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          e.organizer?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || e.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || e.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const categories: ChurchEvent['category'][] = ['Service', 'Youth', 'Outreach', 'Special', 'Meeting', 'Other'];
  const statuses: ChurchEvent['status'][] = ['Upcoming', 'Ongoing', 'Completed', 'Cancelled'];

  // Calendar Logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Church Events</h1>
          <p className="text-neutral-500">Manage and schedule church activities and services</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-xl border border-neutral-200 flex items-center shadow-sm">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'list' ? "bg-primary-50 text-primary-600 shadow-sm" : "text-neutral-400 hover:text-neutral-600"
              )}
              title="List View"
            >
              <LayoutGrid size={20} />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'calendar' ? "bg-primary-50 text-primary-600 shadow-sm" : "text-neutral-400 hover:text-neutral-600"
              )}
              title="Calendar View"
            >
              <CalendarIcon size={20} />
            </button>
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-all shadow-lg shadow-primary-100"
          >
            <Plus size={20} />
            Create Event
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-100 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
            <input
              type="text"
              placeholder="Search events by title, location, or organizer..."
              className="w-full pl-10 pr-4 py-2 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-primary-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-neutral-400" />
            <select
              className="bg-neutral-50 border-none rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary-500"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="All">All Categories</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <select
              className="bg-neutral-50 border-none rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              {statuses.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
            <div key={event.id} className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden hover:shadow-md transition-all group">
              <div className={cn(
                "h-2 w-full",
                event.category === 'Service' ? "bg-blue-500" :
                event.category === 'Youth' ? "bg-purple-500" :
                event.category === 'Outreach' ? "bg-emerald-500" :
                event.category === 'Special' ? "bg-amber-500" :
                event.category === 'Meeting' ? "bg-rose-500" : "bg-neutral-500"
              )} />
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        event.status === 'Upcoming' ? "bg-blue-100 text-blue-700" :
                        event.status === 'Ongoing' ? "bg-emerald-100 text-emerald-700" :
                        event.status === 'Completed' ? "bg-neutral-100 text-neutral-700" :
                        "bg-red-100 text-red-700"
                      )}>
                        {event.status}
                      </span>
                      <span className="text-xs text-neutral-400 font-medium">{event.category}</span>
                    </div>
                    <h3 className="text-xl font-bold text-neutral-900 group-hover:text-primary-600 transition-colors line-clamp-1">
                      {event.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openModal(event)}
                      className="p-2 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setEventToDelete(event.id);
                        setIsDeleteModalOpen(true);
                      }}
                      className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <p className="text-neutral-600 text-sm line-clamp-2 min-h-[40px]">
                  {event.description || 'No description provided.'}
                </p>

                  <div className="pt-4 border-t border-neutral-50 space-y-3">
                    <div className="flex items-center gap-3 text-sm text-neutral-600">
                      <CalendarIcon size={16} className="text-primary-500" />
                      <span>{format(new Date(event.date), 'EEEE, MMMM dd, yyyy')}</span>
                    </div>
                    {event.recurrence_type && event.recurrence_type !== 'None' && (
                      <div className="flex items-center gap-3 text-sm text-primary-600 font-medium bg-primary-50 px-3 py-1.5 rounded-lg">
                        <Repeat size={14} />
                        <span>
                          Repeats {event.recurrence_type.toLowerCase()} 
                          {event.recurrence_interval > 1 ? ` every ${event.recurrence_interval} ${event.recurrence_type === 'Daily' ? 'days' : event.recurrence_type === 'Weekly' ? 'weeks' : event.recurrence_type === 'Monthly' ? 'months' : 'years'}` : ''}
                          {event.recurrence_end_date ? ` until ${format(new Date(event.recurrence_end_date), 'MMM dd, yyyy')}` : ''}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-sm text-neutral-600">
                    <Clock size={16} className="text-primary-500" />
                    <span>{event.time}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-neutral-600">
                    <MapPin size={16} className="text-primary-500" />
                    <span className="line-clamp-1">{event.location || 'Church Premises'}</span>
                  </div>
                  {event.organizer && (
                    <div className="flex items-center gap-3 text-sm text-neutral-600">
                      <User size={16} className="text-primary-500" />
                      <span>{event.organizer}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filteredEvents.length === 0 && (
            <div className="col-span-full py-20 text-center space-y-4 bg-white rounded-2xl border border-dashed border-neutral-200">
              <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto">
                <CalendarIcon size={32} className="text-neutral-300" />
              </div>
              <div className="space-y-1">
                <p className="text-neutral-900 font-semibold text-lg">No events found</p>
                <p className="text-neutral-500">Try adjusting your search or filters, or create a new event.</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden flex flex-col min-h-[600px]">
          <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
            <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-3">
              <CalendarIcon className="text-primary-600" />
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-neutral-200 transition-all text-neutral-600"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setCurrentMonth(new Date())}
                className="px-4 py-2 text-sm font-semibold text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
              >
                Today
              </button>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-neutral-200 transition-all text-neutral-600"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-neutral-100">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-3 text-center text-xs font-bold text-neutral-400 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 flex-1">
            {calendarDays.map((day, idx) => {
              const dayEvents = filteredEvents.filter(e => isEventOnDay(e, day));
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={idx}
                  onClick={() => !dayEvents.length && openModal(null, format(day, 'yyyy-MM-dd'))}
                  className={cn(
                    "min-h-[120px] p-2 border-r border-b border-neutral-100 transition-colors group relative cursor-pointer",
                    !isCurrentMonth ? "bg-neutral-50/30" : "hover:bg-neutral-50/50",
                    idx % 7 === 6 ? "border-r-0" : ""
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={cn(
                      "text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-all",
                      isToday ? "bg-primary-600 text-white shadow-md shadow-primary-100" : 
                      isCurrentMonth ? "text-neutral-700" : "text-neutral-300"
                    )}>
                      {format(day, 'd')}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openModal(null, format(day, 'yyyy-MM-dd'));
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-primary-600 hover:bg-primary-50 rounded-md transition-all"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <div className="space-y-1 overflow-y-auto max-h-[80px] scrollbar-hide">
                    {dayEvents.map(event => (
                      <div
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openModal(event);
                        }}
                        className={cn(
                          "px-2 py-1 rounded text-[10px] font-medium truncate border transition-all hover:scale-[1.02] cursor-pointer",
                          event.category === 'Service' ? "bg-blue-50 text-blue-700 border-blue-100" :
                          event.category === 'Youth' ? "bg-purple-50 text-purple-700 border-purple-100" :
                          event.category === 'Outreach' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                          event.category === 'Special' ? "bg-amber-50 text-amber-700 border-amber-100" :
                          event.category === 'Meeting' ? "bg-rose-50 text-rose-700 border-rose-100" :
                          "bg-neutral-50 text-neutral-700 border-neutral-100"
                        )}
                        title={`${event.time} - ${event.title}`}
                      >
                        <span className="font-bold mr-1">{event.time}</span>
                        {event.recurrence_type && event.recurrence_type !== 'None' && <Repeat size={10} className="inline mr-1" />}
                        {event.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-neutral-900">
                {editingEvent ? 'Edit Event' : 'Create New Event'}
              </h2>
              <button onClick={closeModal} className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                    <Info size={16} /> Event Title
                  </label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="e.g., Sunday Worship Service"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                    <Tag size={16} /> Description
                  </label>
                  <textarea
                    rows={3}
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                    placeholder="Provide details about the event..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                      <CalendarIcon size={16} /> Date
                    </label>
                    <input
                      required
                      type="date"
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                      <Clock size={16} /> Time
                    </label>
                    <input
                      required
                      type="time"
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                      <MapPin size={16} /> Location
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="e.g., Main Auditorium"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                      <User size={16} /> Organizer
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="e.g., Youth Ministry"
                      value={formData.organizer}
                      onChange={(e) => setFormData({ ...formData, organizer: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                      <Filter size={16} /> Category
                    </label>
                    <select
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as ChurchEvent['category'] })}
                    >
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                      <Info size={16} /> Status
                    </label>
                    <select
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as ChurchEvent['status'] })}
                    >
                      {statuses.map(status => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-100 space-y-4">
                  <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                    <Repeat size={18} className="text-primary-600" />
                    Recurrence Settings
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-neutral-500">Repeat</label>
                      <select
                        className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                        value={formData.recurrence_type}
                        onChange={(e) => setFormData({ ...formData, recurrence_type: e.target.value as ChurchEvent['recurrence_type'] })}
                      >
                        <option value="None">Does not repeat</option>
                        <option value="Daily">Daily</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                        <option value="Yearly">Yearly</option>
                      </select>
                    </div>

                    {formData.recurrence_type !== 'None' && (
                      <>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-neutral-500">Every (Interval)</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                              value={formData.recurrence_interval}
                              onChange={(e) => setFormData({ ...formData, recurrence_interval: parseInt(e.target.value) || 1 })}
                            />
                            <span className="text-xs text-neutral-400 font-medium">
                              {formData.recurrence_type === 'Daily' ? 'days' : 
                               formData.recurrence_type === 'Weekly' ? 'weeks' : 
                               formData.recurrence_type === 'Monthly' ? 'months' : 'years'}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-neutral-500">Ends On (Optional)</label>
                          <input
                            type="date"
                            className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                            value={formData.recurrence_end_date}
                            onChange={(e) => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 px-6 bg-neutral-100 text-neutral-600 rounded-xl font-semibold hover:bg-neutral-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 px-6 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-100"
                >
                  {editingEvent ? 'Save Changes' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-6">
            <div className="flex items-center gap-4 text-red-600">
              <div className="p-3 bg-red-50 rounded-xl">
                <AlertCircle size={24} />
              </div>
              <h2 className="text-xl font-bold">Delete Event</h2>
            </div>
            
            <p className="text-neutral-600">
              Are you sure you want to delete this event? This action cannot be undone.
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setEventToDelete(null);
                }}
                className="flex-1 py-3 px-6 bg-neutral-100 text-neutral-600 rounded-xl font-semibold hover:bg-neutral-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 px-6 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
