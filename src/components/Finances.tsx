import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Finance, FinanceCategory, OperationType } from '../types';
import { Plus, Edit2, Trash2, X, Wallet, TrendingUp, TrendingDown, Filter, PieChart, Settings, Calendar } from 'lucide-react';
import { format, isSameDay, isSameWeek, isSameMonth } from 'date-fns';
import { cn } from '../lib/utils';
import { handleDatabaseError, useAuth } from '../App';

export function Finances() {
  const { user } = useAuth();
  const [finances, setFinances] = useState<Finance[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Finance | null>(null);
  const [editingCategory, setEditingCategory] = useState<FinanceCategory | null>(null);
  const [filterType, setFilterType] = useState<string>('All');
  const [timeFilter, setTimeFilter] = useState<string>('All');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Category Form state
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    type: 'Income' as const,
  });

  // Form state
  const [formData, setFormData] = useState({
    type: 'Income' as const,
    category: '',
    amount: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
  });

  useEffect(() => {
    fetchFinances();
    fetchCategories();

    const financesSubscription = supabase
      .channel('finances-changes')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'finances' }, () => {
        fetchFinances();
      })
      .subscribe();

    const categoriesSubscription = supabase
      .channel('categories-changes')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'finance_categories' }, () => {
        fetchCategories();
      })
      .subscribe();

    return () => {
      financesSubscription.unsubscribe();
      categoriesSubscription.unsubscribe();
    };
  }, []);

  const fetchFinances = async () => {
    try {
      const { data, error } = await supabase
        .from('finances')
        .select('*')
        .order('date', { ascending: false });
      
      if (error) throw error;
      setFinances(data || []);
    } catch (error) {
      handleDatabaseError(error, OperationType.LIST, 'finances');
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('finance_categories')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      handleDatabaseError(error, OperationType.LIST, 'finance_categories');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        type: formData.type,
        category: formData.category,
        amount: formData.amount,
        date: formData.date,
        description: formData.description,
        recorded_by: user?.id,
      };

      if (editingRecord) {
        const { error } = await supabase
          .from('finances')
          .update(data)
          .eq('id', editingRecord.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('finances')
          .insert([data]);
        if (error) throw error;
      }
      await fetchFinances();
      closeModal();
    } catch (error) {
      handleDatabaseError(error, editingRecord ? OperationType.UPDATE : OperationType.CREATE, 'finances');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      const { error } = await supabase
        .from('finances')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await fetchFinances();
    } catch (error) {
      handleDatabaseError(error, OperationType.DELETE, 'finances');
    }
  };

  const openModal = (record?: Finance) => {
    if (record) {
      setEditingRecord(record);
      setFormData({
        type: record.type,
        category: record.category,
        amount: record.amount,
        date: record.date,
        description: record.description || '',
      });
    } else {
      setEditingRecord(null);
      setFormData({
        type: 'Income',
        category: '',
        amount: 0,
        date: format(new Date(), 'yyyy-MM-dd'),
        description: '',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        name: categoryFormData.name,
        type: categoryFormData.type,
      };

      if (editingCategory) {
        const { error } = await supabase
          .from('finance_categories')
          .update(data)
          .eq('id', editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('finance_categories')
          .insert([{ ...data, created_at: new Date().toISOString() }]);
        if (error) throw error;
      }
      closeCategoryModal();
    } catch (error) {
      handleDatabaseError(error, editingCategory ? OperationType.UPDATE : OperationType.CREATE, 'finance_categories');
    }
  };

  const handleCategoryDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this category? Financial records using this category will remain, but the category will no longer be available for new records.')) return;
    try {
      const { error } = await supabase
        .from('finance_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      handleDatabaseError(error, OperationType.DELETE, 'finance_categories');
    }
  };

  const openCategoryModal = (category?: FinanceCategory) => {
    if (category) {
      setEditingCategory(category);
      setCategoryFormData({
        name: category.name,
        type: category.type,
      });
    } else {
      setEditingCategory(null);
      setCategoryFormData({
        name: '',
        type: 'Income',
      });
    }
    setIsCategoryModalOpen(true);
  };

  const closeCategoryModal = () => {
    setIsCategoryModalOpen(false);
    setEditingCategory(null);
  };

  const filteredFinances = finances.filter(f => {
    const matchesType = filterType === 'All' || f.type === filterType;
    if (!matchesType) return false;

    if (dateRange.start && f.date < dateRange.start) return false;
    if (dateRange.end && f.date > dateRange.end) return false;

    if (timeFilter === 'All') return true;
    
    const recordDate = new Date(f.date);
    const now = new Date();

    if (timeFilter === 'Day') {
      return isSameDay(recordDate, now);
    }
    if (timeFilter === 'Week') {
      return isSameWeek(recordDate, now, { weekStartsOn: 1 }); // Assuming week starts on Monday
    }
    if (timeFilter === 'Month') {
      return isSameMonth(recordDate, now);
    }
    
    return true;
  });

  const totalIncome = filteredFinances.filter(f => f.type === 'Income').reduce((sum, f) => sum + f.amount, 0);
  const totalExpense = filteredFinances.filter(f => f.type === 'Expense').reduce((sum, f) => sum + f.amount, 0);
  const balance = totalIncome - totalExpense;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Finances</h1>
          <p className="text-neutral-500">Manage church income and expenditures</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-neutral-700 border border-neutral-200 rounded-xl font-semibold hover:bg-neutral-50 transition-all shadow-sm"
          >
            <Settings size={20} />
            Categories
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-all shadow-lg shadow-purple-100"
          >
            <Plus size={20} />
            Add Record
          </button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <div className="flex items-center gap-3 text-emerald-600 mb-2">
            <TrendingUp size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Total Income</span>
          </div>
          <h2 className="text-2xl font-bold text-neutral-900">GH₵ {totalIncome.toLocaleString()}</h2>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <div className="flex items-center gap-3 text-red-600 mb-2">
            <TrendingDown size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Total Expenses</span>
          </div>
          <h2 className="text-2xl font-bold text-neutral-900">GH₵ {totalExpense.toLocaleString()}</h2>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <div className="flex items-center gap-3 text-purple-600 mb-2">
            <Wallet size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Net Balance</span>
          </div>
          <h2 className="text-2xl font-bold text-neutral-900">GH₵ {balance.toLocaleString()}</h2>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm">
        <div className="flex items-center gap-4 flex-1">
          <Filter size={20} className="text-neutral-400" />
          <div className="flex gap-2">
            {['All', 'Income', 'Expense'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                  filterType === type 
                    ? "bg-purple-600 text-white shadow-md" 
                    : "bg-neutral-50 text-neutral-500 hover:bg-neutral-100"
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        
        <div className="h-px md:h-8 w-full md:w-px bg-neutral-100" />

        <div className="flex items-center gap-4 flex-1">
          <Calendar size={20} className="text-neutral-400" />
          <div className="flex gap-2">
            {['All', 'Day', 'Week', 'Month'].map((time) => (
              <button
                key={time}
                onClick={() => setTimeFilter(time)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                  timeFilter === time 
                    ? "bg-purple-600 text-white shadow-md" 
                    : "bg-neutral-50 text-neutral-500 hover:bg-neutral-100"
                )}
              >
                {time === 'All' ? 'All Time' : time}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px md:h-8 w-full md:w-px bg-neutral-100" />

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">From</span>
            <input
              type="date"
              className="px-3 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-purple-500 outline-none text-sm"
              value={dateRange.start}
              onChange={(e) => {
                const start = e.target.value;
                setDateRange((prev) => {
                  const end = prev.end && start && prev.end < start ? start : prev.end;
                  return { ...prev, start, end };
                });
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">To</span>
            <input
              type="date"
              className="px-3 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-purple-500 outline-none text-sm"
              value={dateRange.end}
              min={dateRange.start || undefined}
              onChange={(e) => {
                const end = e.target.value;
                setDateRange((prev) => ({ ...prev, end }));
              }}
            />
          </div>

          {(dateRange.start || dateRange.end) && (
            <button
              type="button"
              onClick={() => setDateRange({ start: '', end: '' })}
              className="px-3 py-2 rounded-xl text-sm font-medium bg-neutral-50 text-neutral-500 hover:bg-neutral-100 transition-all"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Finances Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Description</th>
                <th className="px-6 py-4 font-semibold">Amount</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredFinances.map((record) => (
                <tr key={record.id} className="hover:bg-neutral-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        record.type === 'Income' ? "bg-emerald-500" : "bg-red-500"
                      )} />
                      <div className="font-semibold text-neutral-900">{record.category}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-600 max-w-xs truncate">
                    {record.description || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className={cn(
                      "font-bold",
                      record.type === 'Income' ? "text-emerald-600" : "text-red-600"
                    )}>
                      {record.type === 'Income' ? '+' : '-'} GH₵ {record.amount.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-600">
                    {format(new Date(record.date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openModal(record)}
                        className="p-2 text-neutral-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(record.id)}
                        className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredFinances.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-neutral-400">
                    <div className="flex flex-col items-center gap-2">
                      <Wallet size={48} className="text-neutral-200" />
                      <p>No financial records found.</p>
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
                {editingRecord ? 'Edit Financial Record' : 'Add Financial Record'}
              </h2>
              <button onClick={closeModal} className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="flex gap-4 p-1 bg-neutral-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'Income' })}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                    formData.type === 'Income' ? "bg-white text-emerald-600 shadow-sm" : "text-neutral-500"
                  )}
                >
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'Expense' })}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                    formData.type === 'Expense' ? "bg-white text-red-600 shadow-sm" : "text-neutral-500"
                  )}
                >
                  Expense
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700">Category *</label>
                <select
                  required
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-purple-500 outline-none"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="">Select a category</option>
                  {categories
                    .filter(c => c.type === formData.type)
                    .map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))
                  }
                </select>
                {categories.filter(c => c.type === formData.type).length === 0 && (
                  <p className="text-xs text-amber-600">No categories found for {formData.type}. Please add some in Category Settings.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Amount (GH₵) *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-purple-500 outline-none"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Date *</label>
                  <input
                    required
                    type="date"
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-purple-500 outline-none"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700">Description</label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
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
                  className="flex-1 py-3 px-6 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-100"
                >
                  {editingRecord ? 'Save Changes' : 'Add Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Category Management Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-neutral-900">Manage Categories</h2>
              <button 
                onClick={closeCategoryModal} 
                className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Add/Edit Category Form */}
              <form onSubmit={handleCategorySubmit} className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 space-y-4">
                <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider">
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-neutral-500 uppercase">Category Name</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-2 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-purple-500 outline-none"
                      value={categoryFormData.name}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-neutral-500 uppercase">Type</label>
                    <select
                      className="w-full px-4 py-2 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-purple-500 outline-none"
                      value={categoryFormData.type}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, type: e.target.value as any })}
                    >
                      <option value="Income">Income</option>
                      <option value="Expense">Expense</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                  >
                    {editingCategory ? 'Update Category' : 'Add Category'}
                  </button>
                  {editingCategory && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategory(null);
                        setCategoryFormData({ name: '', type: 'Income' });
                      }}
                      className="px-4 py-2 bg-neutral-200 text-neutral-600 rounded-lg font-semibold hover:bg-neutral-300 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              {/* Categories List */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider">Existing Categories</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['Income', 'Expense'].map(type => (
                    <div key={type} className="space-y-2">
                      <h4 className={cn(
                        "text-xs font-bold uppercase tracking-wider",
                        type === 'Income' ? "text-emerald-600" : "text-red-600"
                      )}>{type} Categories</h4>
                      <div className="space-y-2">
                        {categories.filter(c => c.type === type).map(category => (
                          <div key={category.id} className="flex items-center justify-between p-3 bg-white border border-neutral-100 rounded-xl group">
                            <span className="font-medium text-neutral-700">{category.name}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openCategoryModal(category)}
                                className="p-1.5 text-neutral-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleCategoryDelete(category.id)}
                                className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                        {categories.filter(c => c.type === type).length === 0 && (
                          <p className="text-xs text-neutral-400 italic">No {type.toLowerCase()} categories added yet.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
