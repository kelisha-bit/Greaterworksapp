import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Tithe, Member, OperationType } from '../types';
import { Plus, Search, Edit2, Trash2, X, HandCoins, Filter, Download, Users, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { handleDatabaseError, useAuth } from '../App';

export function Tithes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tithes, setTithes] = useState<Tithe[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTithe, setEditingTithe] = useState<Tithe | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [memberFilter, setMemberFilter] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    memberId: '',
    amount: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
    paymentMethod: 'Cash' as const,
  });

  useEffect(() => {
    fetchTithes();
    fetchMembers();

    const tithesSubscription = supabase
      .channel('tithes-changes')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'tithes' }, () => {
        fetchTithes();
      })
      .subscribe();

    const membersSubscription = supabase
      .channel('members-changes')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'members' }, () => {
        fetchMembers();
      })
      .subscribe();

    return () => {
      tithesSubscription.unsubscribe();
      membersSubscription.unsubscribe();
    };
  }, []);

  const fetchTithes = async () => {
    try {
      const { data, error } = await supabase
        .from('tithes')
        .select('*')
        .order('date', { ascending: false });
      
      if (error) throw error;
      setTithes(data || []);
    } catch (error) {
      handleDatabaseError(error, OperationType.LIST, 'tithes');
    }
  };

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*');
      
      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      handleDatabaseError(error, OperationType.LIST, 'members');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const member = members.find(m => m.id === formData.memberId);
    if (!member) return;

    try {
      const data = {
        member_id: formData.memberId,
        amount: formData.amount,
        date: formData.date,
        payment_method: formData.paymentMethod,
        member_name: `${member.first_name} ${member.last_name}`,
        recorded_by: user?.id,
      };

      if (editingTithe) {
        const { error } = await supabase
          .from('tithes')
          .update(data)
          .eq('id', editingTithe.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tithes')
          .insert([data]);
        if (error) throw error;
      }
      await fetchTithes();
      closeModal();
    } catch (error) {
      handleDatabaseError(error, editingTithe ? OperationType.UPDATE : OperationType.CREATE, 'tithes');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      const { error } = await supabase
        .from('tithes')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await fetchTithes();
    } catch (error) {
      handleDatabaseError(error, OperationType.DELETE, 'tithes');
    }
  };

  const openModal = (tithe?: Tithe) => {
    if (tithe) {
      setEditingTithe(tithe);
      setFormData({
        memberId: tithe.member_id,
        amount: tithe.amount,
        date: tithe.date,
        paymentMethod: tithe.payment_method,
      });
    } else {
      setEditingTithe(null);
      setFormData({
        memberId: '',
        amount: 0,
        date: format(new Date(), 'yyyy-MM-dd'),
        paymentMethod: 'Cash',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTithe(null);
  };

  const exportToCsv = () => {
    const escapeCsv = (value: unknown) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (/[\n\r,\"]/g.test(str)) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };

    const header = ['Member', 'Amount', 'Date', 'Payment Method'];
    const rows = filteredTithes.map(t => [
      t.member_name,
      t.amount,
      t.date,
      t.payment_method,
    ]);

    const csv = [header, ...rows]
      .map(row => row.map(escapeCsv).join(','))
      .join('\n');

    const start = startDate || 'all';
    const end = endDate || 'all';
    const fileName = `tithes_${start}_to_${end}.csv`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const printReceipt = (tithe: Tithe) => {
    const receiptHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Tithe Receipt</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              text-align: center;
            }
            .receipt {
              max-width: 400px;
              margin: 0 auto;
              border: 1px solid #ccc;
              padding: 20px;
              background: white;
            }
            .header {
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            .church-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .receipt-title {
              font-size: 18px;
              margin-bottom: 20px;
            }
            .details {
              text-align: left;
              margin-bottom: 20px;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 10px;
            }
            .amount {
              font-size: 20px;
              font-weight: bold;
              color: #059669;
            }
            .footer {
              border-top: 1px solid #ccc;
              padding-top: 10px;
              font-size: 12px;
              color: #666;
            }
            @media print {
              body { margin: 0; }
              .receipt { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <div class="church-name">Greater Works City Church</div>
              <div>Accra, Ghana</div>
            </div>
            <div class="receipt-title">Tithe Receipt</div>
            <div class="details">
              <div class="detail-row">
                <span>Receipt No:</span>
                <span>${tithe.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div class="detail-row">
                <span>Member:</span>
                <span>${tithe.member_name}</span>
              </div>
              <div class="detail-row">
                <span>Amount:</span>
                <span class="amount">GH₵ ${tithe.amount.toLocaleString()}</span>
              </div>
              <div class="detail-row">
                <span>Date:</span>
                <span>${format(new Date(tithe.date), 'MMMM dd, yyyy')}</span>
              </div>
              <div class="detail-row">
                <span>Payment Method:</span>
                <span>${tithe.payment_method}</span>
              </div>
            </div>
            <div class="footer">
              Thank you for your generous contribution.<br>
              "Bring the whole tithe into the storehouse..." - Malachi 3:10
            </div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  };

  const filteredTithes = tithes.filter(t => {
    const matchesSearch = t.member_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         t.payment_method.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPaymentMethod = paymentMethodFilter === '' || t.payment_method === paymentMethodFilter;
    const matchesMember = memberFilter === '' || t.member_id === memberFilter;
    const matchesDateRange = (!startDate || t.date >= startDate) && (!endDate || t.date <= endDate);
    
    return matchesSearch && matchesPaymentMethod && matchesMember && matchesDateRange;
  });

  const totalTithes = filteredTithes.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Tithes</h1>
          <p className="text-neutral-500">Track and manage member tithe contributions</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
        >
          <Plus size={20} />
          Record Tithe
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 md:col-span-2 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-500 uppercase tracking-wider">Total Recorded</p>
            <h2 className="text-3xl font-bold text-neutral-900 mt-1">GH₵ {totalTithes.toLocaleString()}</h2>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600">
            <HandCoins size={32} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 flex flex-col justify-center">
          <p className="text-sm font-medium text-neutral-500 uppercase tracking-wider">Records Count</p>
          <h2 className="text-3xl font-bold text-neutral-900 mt-1">{filteredTithes.length}</h2>
        </div>
      </div>

      {/* Search & Actions */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
            <input
              type="text"
              placeholder="Search by member name..."
              className="w-full pl-10 pr-4 py-2 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-neutral-400" />
              <select
                className="px-3 py-2 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
              >
                <option value="">All Methods</option>
                <option value="Cash">Cash</option>
                <option value="Check">Check</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Mobile Money">Mobile Money</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Users size={18} className="text-neutral-400" />
              <select
                className="px-3 py-2 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
              >
                <option value="">All Members</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="px-3 py-2 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Start Date"
              />
              <span className="text-neutral-400 text-sm">to</span>
              <input
                type="date"
                className="px-3 py-2 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="End Date"
              />
              {(startDate || endDate || paymentMethodFilter || memberFilter) && (
                <button 
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setPaymentMethodFilter('');
                    setMemberFilter('');
                  }}
                  className="p-2 text-neutral-400 hover:text-red-600 transition-colors"
                  title="Clear filters"
                >
                  <X size={18} />
                </button>
              )}
            </div>
            <button
              onClick={exportToCsv}
              disabled={filteredTithes.length === 0}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-colors ml-auto",
                filteredTithes.length === 0
                  ? "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              )}
            >
              <Download size={18} />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Tithes Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Member</th>
                <th className="px-6 py-4 font-semibold">Amount</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Method</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredTithes.map((tithe) => (
                <tr key={tithe.id} className="hover:bg-neutral-50 transition-colors group">
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => navigate(`/members?id=${tithe.member_id}`)}
                      className="font-semibold text-neutral-900 hover:text-emerald-600 transition-colors text-left"
                    >
                      {tithe.member_name}
                    </button>
                    <div className="text-xs text-neutral-500">ID: {tithe.member_id.slice(0, 8)}...</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-emerald-600">GH₵ {tithe.amount.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-600">
                    {format(new Date(tithe.date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-700">
                      {tithe.payment_method}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => printReceipt(tithe)}
                        className="p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Print Receipt"
                      >
                        <Printer size={18} />
                      </button>
                      <button 
                        onClick={() => openModal(tithe)}
                        className="p-2 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      {user?.role === 'admin' && (
                        <button 
                          onClick={() => handleDelete(tithe.id)}
                          className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTithes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-neutral-400">
                    <div className="flex flex-col items-center gap-2">
                      <HandCoins size={48} className="text-neutral-200" />
                      <p>No tithe records found.</p>
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
                {editingTithe ? 'Edit Tithe Record' : 'Record New Tithe'}
              </h2>
              <button onClick={closeModal} className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700">Select Member *</label>
                <select
                  required
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={formData.memberId}
                  onChange={(e) => setFormData({ ...formData, memberId: e.target.value })}
                >
                  <option value="">-- Choose Member --</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Amount (GH₵) *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Date *</label>
                  <input
                    required
                    type="date"
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700">Payment Method</label>
                <select
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                >
                  <option value="Cash">Cash</option>
                  <option value="Check">Check</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Mobile Money">Mobile Money</option>
                </select>
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
                  className="flex-1 py-3 px-6 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
                >
                  {editingTithe ? 'Save Changes' : 'Record Tithe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
