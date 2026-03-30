import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { handleDatabaseError, useAuth } from '../App';
import { OperationType, StaffMember, StaffPosition } from '../types';
import { Search, Users, Plus, X, Upload } from 'lucide-react';
import { format } from 'date-fns';

type MemberNameOption = {
  id: string;
  first_name: string;
  last_name: string;
};

export function Staff() {
  const { user } = useAuth();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<MemberNameOption[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const fetchStaff = async (mode: 'initial' | 'refresh' = 'initial') => {
    try {
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);

      const { data, error } = await supabase
        .from('staff_members')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStaff(data ?? []);
    } catch (error) {
      handleDatabaseError(error, OperationType.LIST, 'staff_members');
    } finally {
      if (mode === 'initial') setLoading(false);
      if (mode === 'refresh') setRefreshing(false);
    }
  };

  const fetchMembersForStaffModal = async () => {
    try {
      setMembersLoading(true);
      const { data, error } = await supabase
        .from('members')
        .select('id, first_name, last_name')
        .order('first_name', { ascending: true });

      if (error) throw error;
      setMembers((data ?? []) as MemberNameOption[]);
    } catch (error) {
      handleDatabaseError(error, OperationType.LIST, 'members');
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff('initial');

    const subscription = supabase
      .channel('staff-changes')
      .on(
        'postgres_changes' as any,
        { event: '*', table: 'staff_members' },
        () => fetchStaff('refresh')
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }, []);

  const positionOptions: StaffPosition[] = [
    'Senior pastor',
    'Assistant pastor',
    'Department head',
    'Church secretary',
    'Ministry leader',
    'Church treasurer',
    'Church usher leader',
    'Church choir leader',
    'Church prayer leader',
    'Church evangelism leader',
    'Church media leader',
    'Church welfare leader',
    'Church other leader',
  ];

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canManageStaff = user?.role === 'admin';

  const [formData, setFormData] = useState({
    memberId: '',
    full_name: '',
    position: 'Senior pastor' as StaffPosition,
    department: '',
    ministry: '',
    email: '',
    phone: '',
    bio: '',
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  const resetForm = () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setFormData({
      memberId: '',
      full_name: '',
      position: 'Senior pastor',
      department: '',
      ministry: '',
      email: '',
      phone: '',
      bio: '',
    });
  };

  useEffect(() => {
    if (!canManageStaff && isAddOpen) {
      setIsAddOpen(false);
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageStaff]);

  useEffect(() => {
    if (isAddOpen && members.length === 0 && !membersLoading) {
      fetchMembersForStaffModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAddOpen]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.memberId.trim()) return;
    if (!formData.full_name.trim()) return;
    if (!formData.department.trim()) return;
    if (!formData.ministry.trim()) return;
    if (!formData.email.trim()) return;

    setIsSubmitting(true);
    try {
      let photoUrl: string | null = null;

      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop() || 'png';
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `staff-photos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('staff-photos')
          .upload(filePath, photoFile);
        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from('staff-photos')
          .getPublicUrl(filePath);

        photoUrl = publicData.publicUrl ?? null;
      }

      const staffData = {
        full_name: formData.full_name.trim(),
        position: formData.position,
        department: formData.department.trim(),
        ministry: formData.ministry.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() ? formData.phone.trim() : null,
        bio: formData.bio.trim() ? formData.bio.trim() : null,
        photo_url: photoUrl,
      };

      const { error: insertError } = await supabase
        .from('staff_members')
        .insert([staffData]);

      if (insertError) throw insertError;

      // Refresh list and close modal
      setIsAddOpen(false);
      resetForm();
      await fetchStaff('refresh');
    } catch (error) {
      handleDatabaseError(error, OperationType.CREATE, 'staff_members');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStaff = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return staff;

    return staff.filter((s) => {
      return (
        s.full_name.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term) ||
        (s.position ?? '').toLowerCase().includes(term) ||
        (s.department ?? '').toLowerCase().includes(term) ||
        (s.ministry ?? '').toLowerCase().includes(term)
      );
    });
  }, [staff, searchTerm]);

  const staffCount = staff.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[300px] bg-neutral-50 rounded-2xl border border-neutral-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Staff</h1>
          <p className="text-neutral-500">
            Manage and view your church staff ({staffCount})
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-[560px]">
          <div className="bg-white p-3 rounded-2xl shadow-sm border border-neutral-100 flex items-center gap-3 w-full">
            <Search size={18} className="text-neutral-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, position..."
              className="w-full bg-transparent outline-none text-sm"
            />
          </div>

          {canManageStaff && (
            <button
              onClick={() => {
                setIsAddOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-all shadow-lg shadow-primary-100 shrink-0"
            >
              <Plus size={18} />
              Add staff
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-primary-600" />
            <h2 className="text-lg font-bold text-neutral-900">Staff List</h2>
          </div>
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">
            {filteredStaff.length} shown
          </p>
        </div>

        <div className="p-6">
          {filteredStaff.length === 0 ? (
            <div className="py-16 text-center text-neutral-400">
              No staff found.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredStaff.map((member) => (
                <div
                  key={member.id}
                  className="bg-white border border-neutral-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="p-5 flex items-start gap-4">
                    <div className="w-16 h-16 rounded-full bg-neutral-200 overflow-hidden flex items-center justify-center shrink-0">
                      {member.photo_url ? (
                        <img
                          src={member.photo_url}
                          alt={member.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-neutral-700 font-bold">
                          {member.full_name?.[0] || 'S'}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-neutral-900 truncate">
                            {member.full_name}
                          </div>
                          <div className="text-xs text-neutral-500 truncate">
                            ID: {String(member.id).slice(0, 8)}...
                          </div>
                        </div>
                      </div>

                      <div className="mt-2">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary-50 text-primary-700">
                          {member.position}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1.5">
                        <div className="text-sm font-semibold text-neutral-700 truncate">
                          {member.department}
                        </div>
                        <div className="text-sm text-neutral-600 truncate">
                          {member.ministry}
                        </div>
                        <div className="text-xs text-neutral-500 truncate">
                          {member.email}
                        </div>
                        {member.phone ? (
                          <div className="text-xs text-neutral-500 truncate">
                            {member.phone}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {member.bio ? (
                    <div className="px-5 pb-5">
                      <p className="text-sm text-neutral-600 line-clamp-3">
                        {member.bio}
                      </p>
                    </div>
                  ) : null}

                  <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/40 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-neutral-500">
                      Joined
                    </span>
                    <span className="text-xs text-neutral-700">
                      {member.created_at
                        ? format(new Date(member.created_at), 'MMM dd, yyyy')
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {refreshing && (
          <div className="border-t border-neutral-100 px-6 py-4 text-xs text-neutral-400">
            Updating staff list...
          </div>
        )}
      </div>

      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-neutral-900">Add Staff Member</h2>
                <p className="text-sm text-neutral-500">
                  Create a new church staff profile
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  resetForm();
                }}
                className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg"
                aria-label="Close"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Full name</label>
                  <select
                    required
                    disabled={membersLoading}
                    value={formData.memberId}
                    onChange={(e) => {
                      const memberId = e.target.value;
                      const selected = members.find((m) => m.id === memberId);
                      setFormData({
                        ...formData,
                        memberId,
                        full_name: selected ? `${selected.first_name} ${selected.last_name}` : '',
                      });
                    }}
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                  >
                    <option value="" disabled>
                      {membersLoading ? 'Loading members...' : 'Select member...'}
                    </option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.first_name} {m.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Position</label>
                  <select
                    required
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value as StaffPosition })}
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                  >
                    {positionOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Department</label>
                  <input
                    required
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="e.g., Operations / Administration"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Ministry</label>
                  <input
                    required
                    type="text"
                    value={formData.ministry}
                    onChange={(e) => setFormData({ ...formData, ministry: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="e.g., Youth Ministry"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Email</label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="staff@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="+233 ..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700">Bio</label>
                <textarea
                  rows={4}
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                  placeholder="Short description about the staff member..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                  <Upload size={18} />
                  Photo
                </label>

                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-neutral-200 overflow-hidden flex items-center justify-center">
                    {photoPreviewUrl ? (
                      <img
                        src={photoPreviewUrl}
                        alt="Staff preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-neutral-500 text-sm font-bold">
                        {formData.full_name?.[0] || 'S'}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        if (!file) {
                          if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
                          setPhotoFile(null);
                          setPhotoPreviewUrl(null);
                          return;
                        }
                        if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
                        setPhotoFile(file);
                        setPhotoPreviewUrl(URL.createObjectURL(file));
                      }}
                      className="block w-full text-sm text-neutral-600"
                    />
                    <p className="text-xs text-neutral-400">
                      Optional. Upload a clear headshot for best results.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddOpen(false);
                    resetForm();
                  }}
                  className="flex-1 py-3 px-6 bg-neutral-100 text-neutral-600 rounded-xl font-semibold hover:bg-neutral-200 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || membersLoading}
                  className="flex-1 py-3 px-6 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-100 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Adding...' : 'Add staff member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

