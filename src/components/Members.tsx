import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { Member, OperationType, MemberGroup, MemberDepartment, Tithe, CustomFieldDefinition, MemberRelationship, MemberAttendance, Attendance } from '../types';
import { Plus, Search, MoreVertical, Edit2, Trash2, X, UserPlus, Filter, Users, Upload, Download, Eye, Phone, Mail, MapPin, Calendar, Briefcase, GraduationCap, Heart, ShieldCheck, Users2, FileText, Camera, User, Settings, ReceiptText, DollarSign, ListPlus, Trash, RotateCcw, Building2, Link, History, Activity } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { cn } from '../lib/utils';
import { handleDatabaseError, useAuth } from '../App';
import Papa from 'papaparse';
import { toast } from 'sonner';
import Cropper from 'react-easy-crop';
import { CustomFieldsModal } from './CustomFieldsModal';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

export function Members() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [members, setMembers] = useState<Member[]>([]);
  const [memberGroups, setMemberGroups] = useState<MemberGroup[]>([]);
  const [memberDepartments, setMemberDepartments] = useState<MemberDepartment[]>([]);
  const [customFieldDefinitions, setCustomFieldDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
  const [isCustomFieldsModalOpen, setIsCustomFieldsModalOpen] = useState(false);
  const [isRelationshipModalOpen, setIsRelationshipModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [viewingMember, setViewingMember] = useState<Member | null>(null);
  const [viewTab, setViewTab] = useState<'profile' | 'tithes' | 'relationships' | 'attendance'>('profile');
  const [memberTithes, setMemberTithes] = useState<Tithe[]>([]);
  const [memberRelationships, setMemberRelationships] = useState<(MemberRelationship & { related_member: Member })[]>([]);
  const [memberAttendance, setMemberAttendance] = useState<(MemberAttendance & { attendance: Attendance })[]>([]);
  const [isLoadingTithes, setIsLoadingTithes] = useState(false);
  const [isLoadingRelationships, setIsLoadingRelationships] = useState(false);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [groupFilter, setGroupFilter] = useState<string>('All');
  const [ministryFilter, setMinistryFilter] = useState<string>('All');
  const [departmentFilter, setDepartmentFilter] = useState<string>('All');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Cropping state
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [tempPhotoUrl, setTempPhotoUrl] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    address: '',
    gender: 'Male' as const,
    birthday: '',
    dateJoined: format(new Date(), 'yyyy-MM-dd'),
    status: 'Active' as const,
    maritalStatus: 'Single' as const,
    occupation: '',
    education: '',
    baptismStatus: 'Not Baptized' as const,
    baptismDate: '',
    membershipDate: format(new Date(), 'yyyy-MM-dd'),
    ministry: '',
    department: '',
    departmentId: '',
    group: '',
    customFields: {} as Record<string, any>,
    emergencyContact: {
      name: '',
      relationship: '',
      phoneNumber: '',
    },
    note: '',
  });

  const educationOptions = [
    'None',
    'Primary',
    'Junior High School (JHS)',
    'Senior High School (SHS)',
    'Tertiary',
    'Bachelor\'s Degree',
    'Master\'s Degree',
    'PhD',
    'Other',
  ];

  const ministryOptions = [
    'None',
    'Children\'s Ministry',
    'Youth Ministry',
    'Men\'s Ministry',
    'Women\'s Ministry',
    'Choir / Music',
    'Ushering',
    'Prayer / Intercession',
    'Evangelism / Outreach',
    'Media / Technical',
    'Welfare',
    'Other',
  ];

  const [relationshipFormData, setRelationshipFormData] = useState({
    relatedMemberId: '',
    relationshipType: 'Other' as MemberRelationship['relationship_type'],
  });

  useEffect(() => {
    fetchMembers();
    fetchGroups();
    fetchDepartments();
    fetchCustomFieldDefinitions();

    // Set up real-time subscriptions
    const membersSubscription = supabase
      .channel('public:members')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => {
        fetchMembers();
      })
      .subscribe();

    const groupsSubscription = supabase
      .channel('public:member_groups')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_groups' }, () => {
        fetchGroups();
      })
      .subscribe();

    const departmentsSubscription = supabase
      .channel('public:member_departments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_departments' }, () => {
        fetchDepartments();
      })
      .subscribe();

    const customFieldsSubscription = supabase
      .channel('public:custom_field_definitions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_field_definitions' }, () => {
        fetchCustomFieldDefinitions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(membersSubscription);
      supabase.removeChannel(groupsSubscription);
      supabase.removeChannel(departmentsSubscription);
      supabase.removeChannel(customFieldsSubscription);
    };
  }, []);

  useEffect(() => {
    if (viewingMember) {
      fetchMemberTithes(viewingMember.id);
      fetchMemberRelationships(viewingMember.id);
      fetchMemberAttendance(viewingMember.id);
    } else {
      setMemberTithes([]);
      setMemberRelationships([]);
      setMemberAttendance([]);
      setViewTab('profile');
    }
  }, [viewingMember]);

  const fetchMemberRelationships = async (memberId: string) => {
    setIsLoadingRelationships(true);
    try {
      const { data, error } = await supabase
        .from('member_relationships')
        .select(`
          *,
          related_member:members!member_relationships_related_member_id_fkey (*)
        `)
        .eq('member_id', memberId);
      
      if (error) throw error;
      setMemberRelationships(data || []);
    } catch (error) {
      console.error('Error fetching member relationships:', error);
    } finally {
      setIsLoadingRelationships(false);
    }
  };

  const fetchMemberAttendance = async (memberId: string) => {
    setIsLoadingAttendance(true);
    try {
      const { data, error } = await supabase
        .from('member_attendance')
        .select(`
          *,
          attendance:attendance (*)
        `)
        .eq('member_id', memberId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setMemberAttendance(data || []);
    } catch (error) {
      console.error('Error fetching member attendance:', error);
    } finally {
      setIsLoadingAttendance(false);
    }
  };

  const fetchMemberTithes = async (memberId: string) => {
    setIsLoadingTithes(true);
    try {
      const { data, error } = await supabase
        .from('tithes')
        .select('*')
        .eq('member_id', memberId)
        .order('date', { ascending: false });
      
      if (error) throw error;
      setMemberTithes(data || []);
    } catch (error) {
      console.error('Error fetching member tithes:', error);
    } finally {
      setIsLoadingTithes(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMembers(data.map(m => ({
        id: m.id,
        first_name: m.first_name,
        last_name: m.last_name,
        email: m.email,
        phone_number: m.phone_number,
        address: m.address,
        gender: m.gender,
        birthday: m.birthday,
        date_joined: m.date_joined,
        status: m.status,
        marital_status: m.marital_status,
        occupation: m.occupation,
        education: m.education,
        baptism_status: m.baptism_status,
        baptism_date: m.baptism_date,
        membership_date: m.membership_date,
        ministry: m.ministry,
        department: m.department,
        department_id: m.department_id,
        group_id: m.group_id,
        emergency_contact: m.emergency_contact,
        note: m.note,
        photo_url: m.photo_url,
        custom_fields: m.custom_fields || {},
        created_at: m.created_at
      } as Member)));
    } catch (error) {
      handleDatabaseError(error, OperationType.LIST, 'members');
    }
  };

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('member_groups')
        .select('*')
        .order('name');

      if (error) throw error;
      setMemberGroups(data.map(g => ({
        id: g.id,
        name: g.name,
        description: g.description,
        created_at: g.created_at,
        updated_at: g.updated_at
      } as MemberGroup)));
    } catch (error) {
      handleDatabaseError(error, OperationType.LIST, 'member_groups');
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('member_departments')
        .select('*')
        .order('name');

      if (error) throw error;
      setMemberDepartments(data.map(d => ({
        id: d.id,
        name: d.name,
        description: d.description,
        created_at: d.created_at,
        updated_at: d.updated_at
      } as MemberDepartment)));
    } catch (error) {
      handleDatabaseError(error, OperationType.LIST, 'member_departments');
    }
  };

  const fetchCustomFieldDefinitions = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setCustomFieldDefinitions(data || []);
    } catch (error) {
      handleDatabaseError(error, OperationType.LIST, 'custom_field_definitions');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      let photoUrl = editingMember?.photo_url || '';

      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `member-photos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('member-photos')
          .upload(filePath, photoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('member-photos')
          .getPublicUrl(filePath);
        
        photoUrl = publicUrl;
      } else if (!photoPreview) {
        // Photo was removed
        photoUrl = '';
      }

      const memberData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone_number: formData.phoneNumber,
        address: formData.address,
        gender: formData.gender,
        birthday: formData.birthday || null,
        date_joined: formData.dateJoined,
        status: formData.status,
        marital_status: formData.maritalStatus,
        occupation: formData.occupation,
        education: formData.education,
        baptism_status: formData.baptismStatus,
        baptism_date: formData.baptismDate || null,
        membership_date: formData.membershipDate || null,
        ministry: formData.ministry,
        department: formData.department,
        department_id: formData.departmentId || null,
        group_id: formData.group || null,
        emergency_contact: formData.emergencyContact,
        note: formData.note,
        photo_url: photoUrl,
        custom_fields: formData.customFields,
      };

      if (editingMember) {
        const { error } = await supabase
          .from('members')
          .update(memberData)
          .eq('id', editingMember.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('members')
          .insert([memberData]);
        if (error) throw error;
      }
      closeModal();
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      handleDatabaseError(error, editingMember ? OperationType.UPDATE : OperationType.CREATE, 'members');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this member?')) return;
    try {
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      handleDatabaseError(error, OperationType.DELETE, 'members');
    }
  };

  const handleAddRelationship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingMember || !relationshipFormData.relatedMemberId) return;

    try {
      const { error } = await supabase
        .from('member_relationships')
        .insert([{
          member_id: viewingMember.id,
          related_member_id: relationshipFormData.relatedMemberId,
          relationship_type: relationshipFormData.relationshipType
        }]);

      if (error) throw error;
      
      toast.success('Relationship added successfully');
      setIsRelationshipModalOpen(false);
      setRelationshipFormData({ relatedMemberId: '', relationshipType: 'Other' });
      fetchMemberRelationships(viewingMember.id);
    } catch (error) {
      console.error('Error adding relationship:', error);
      toast.error('Failed to add relationship');
    }
  };

  const handleDeleteRelationship = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this relationship?')) return;

    try {
      const { error } = await supabase
        .from('member_relationships')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Relationship removed');
      if (viewingMember) fetchMemberRelationships(viewingMember.id);
    } catch (error) {
      console.error('Error deleting relationship:', error);
      toast.error('Failed to remove relationship');
    }
  };

  const openModal = (member?: Member) => {
    if (member) {
      setEditingMember(member);
      setFormData({
        firstName: member.first_name,
        lastName: member.last_name,
        email: member.email || '',
        phoneNumber: member.phone_number || '',
        address: member.address || '',
        gender: member.gender,
        birthday: member.birthday || '',
        dateJoined: member.date_joined,
        status: member.status,
        maritalStatus: member.marital_status || 'Single',
        occupation: member.occupation || '',
        education: member.education || '',
        baptismStatus: member.baptism_status || 'Not Baptized',
        baptismDate: member.baptism_date || '',
        membershipDate: member.membership_date || member.date_joined || format(new Date(), 'yyyy-MM-dd'),
        ministry: member.ministry || '',
        department: member.department || '',
        departmentId: member.department_id || '',
        group: member.group_id || '',
        customFields: member.custom_fields || {},
        emergencyContact: member.emergency_contact || { name: '', relationship: '', phone_number: '' },
        note: member.note || '',
      });
    } else {
      setEditingMember(null);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        address: '',
        gender: 'Male',
        birthday: '',
        dateJoined: format(new Date(), 'yyyy-MM-dd'),
        status: 'Active',
        maritalStatus: 'Single',
        occupation: '',
        education: '',
        baptismStatus: 'Not Baptized',
        baptismDate: '',
        membershipDate: format(new Date(), 'yyyy-MM-dd'),
        ministry: '',
        department: '',
        departmentId: '',
        group: '',
        customFields: {},
        emergencyContact: { name: '', relationship: '', phone_number: '' },
        note: '',
      });
    }
    setPhotoFile(null);
    setPhotoPreview(member?.photo_url || null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMember(null);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempPhotoUrl(reader.result as string);
        setIsCropping(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = (_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleCropSave = async () => {
    if (tempPhotoUrl && croppedAreaPixels) {
      try {
        const croppedImageBlob = await getCroppedImg(tempPhotoUrl, croppedAreaPixels);
        const croppedFile = new File([croppedImageBlob], 'profile.jpg', { type: 'image/jpeg' });
        setPhotoFile(croppedFile);
        setPhotoPreview(URL.createObjectURL(croppedImageBlob));
        setIsCropping(false);
        setTempPhotoUrl(null);
      } catch (e) {
        console.error(e);
        toast.error('Failed to crop image');
      }
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  };

  const openViewModal = (member: Member) => {
    setViewingMember(member);
    setIsViewModalOpen(true);
  };

  const closeViewModal = () => {
    setIsViewModalOpen(false);
    setViewingMember(null);
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = `${m.first_name} ${m.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          m.phone_number?.includes(searchTerm) ||
                          m.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || m.status === statusFilter;
    const matchesGroup = groupFilter === 'All' || m.group_id === groupFilter;
    const matchesMinistry = ministryFilter === 'All' || m.ministry === ministryFilter;
    const matchesDepartment = departmentFilter === 'All' || m.department_id === departmentFilter;
    return matchesSearch && matchesStatus && matchesGroup && matchesMinistry && matchesDepartment;
  });

  const sortedMembers = [...filteredMembers].sort((a, b) =>
    (a.first_name || '').localeCompare((b.first_name || ''), undefined, { sensitivity: 'base' })
  );

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const membersToInsert = [];

          for (const row of results.data as any[]) {
            if (!row.firstName || !row.lastName) continue;

            const memberData = {
              first_name: row.firstName,
              last_name: row.lastName,
              email: row.email || '',
              phone_number: row.phoneNumber || '',
              address: row.address || '',
              gender: (['Male', 'Female', 'Other'].includes(row.gender) ? row.gender : 'Male') as any,
              birthday: row.birthday || null,
              date_joined: row.dateJoined || format(new Date(), 'yyyy-MM-dd'),
              status: (['Active', 'Inactive', 'Visitor'].includes(row.status) ? row.status : 'Active') as any,
              marital_status: (['Single', 'Married', 'Widowed', 'Divorced'].includes(row.maritalStatus) ? row.maritalStatus : 'Single') as any,
              occupation: row.occupation || '',
              education: row.education || '',
              baptism_status: (['Baptized', 'Not Baptized'].includes(row.baptismStatus) ? row.baptismStatus : 'Not Baptized') as any,
              ministry: row.ministry || '',
              department: row.department || '',
              department_id: row.departmentId || null,
              group_id: row.group || null,
              note: row.note || '',
              created_at: new Date().toISOString(),
              emergency_contact: (row.emergencyContactName || row.emergencyContactRelationship || row.emergencyContactPhone) ? {
                name: row.emergencyContactName || '',
                relationship: row.emergencyContactRelationship || '',
                phone_number: row.emergencyContactPhone || '',
              } : null
            };

            membersToInsert.push(memberData);
          }

          if (membersToInsert.length > 0) {
            const { error } = await supabase
              .from('members')
              .insert(membersToInsert);
            
            if (error) throw error;
            alert(`Successfully imported ${membersToInsert.length} members.`);
          } else {
            alert('No valid members found in CSV.');
          }
        } catch (error) {
          console.error('Import error:', error);
          alert('Failed to import members. Please check the CSV format.');
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        console.error('CSV parse error:', error);
        alert('Error parsing CSV file.');
        setIsImporting(false);
      }
    });
  };

  const downloadTemplate = () => {
    const headers = [
      'firstName', 'lastName', 'email', 'phoneNumber', 'address', 'gender', 'birthday',
      'dateJoined', 'status', 'maritalStatus', 'occupation', 'education', 
      'baptismStatus', 'ministry', 'department', 'departmentId', 'group', 'note',
      'emergencyContactName', 'emergencyContactRelationship', 'emergencyContactPhone'
    ];
    const csvContent = headers.join(',') + '\n' + 
      'John,Doe,john@example.com,0244123456,Accra,Male,1990-05-15,2024-01-01,Active,Single,Engineer,Degree,Baptized,Men Ministry,Welfare,,Group A,Faithful member,Jane Doe,Wife,0244654321';
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'member_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Members</h1>
          <p className="text-neutral-500">Manage your church congregation</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImport}
          />
          <button
            onClick={downloadTemplate}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-neutral-700 border border-neutral-200 rounded-xl font-semibold hover:bg-neutral-50 transition-all shadow-sm"
          >
            <Download size={18} />
            Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-neutral-700 border border-neutral-200 rounded-xl font-semibold hover:bg-neutral-50 transition-all shadow-sm disabled:opacity-50"
          >
            <Upload size={18} />
            {isImporting ? 'Importing...' : 'Bulk Import'}
          </button>
          {user?.role === 'admin' && (
            <>
              <button
                onClick={() => setIsDepartmentModalOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-neutral-700 border border-neutral-200 rounded-xl font-semibold hover:bg-neutral-50 transition-all shadow-sm"
              >
                <Building2 size={18} />
                Departments
              </button>
              <button
                onClick={() => setIsGroupModalOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-neutral-700 border border-neutral-200 rounded-xl font-semibold hover:bg-neutral-50 transition-all shadow-sm"
              >
                <Settings size={18} />
                Groups
              </button>
              <button
                onClick={() => setIsCustomFieldsModalOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-neutral-700 border border-neutral-200 rounded-xl font-semibold hover:bg-neutral-50 transition-all shadow-sm"
              >
                <ListPlus size={18} />
                Custom Fields
              </button>
            </>
          )}
          <button
            onClick={() => openModal()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-all shadow-lg shadow-primary-100"
          >
            <UserPlus size={20} />
            Add Member
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
          <input
            type="text"
            placeholder="Search by name, phone or email..."
            className="w-full pl-10 pr-4 py-2 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-primary-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={20} className="text-neutral-400" />
          <select
            className="bg-neutral-50 border-none rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Visitor">Visitor</option>
          </select>
          <select
            className="bg-neutral-50 border-none rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary-500"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
          >
            <option value="All">All Groups</option>
            {memberGroups.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
          <select
            className="bg-neutral-50 border-none rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary-500"
            value={ministryFilter}
            onChange={(e) => setMinistryFilter(e.target.value)}
          >
            <option value="All">All Ministries</option>
            {ministryOptions.map(ministry => (
              <option key={ministry} value={ministry}>{ministry}</option>
            ))}
          </select>
          <select
            className="bg-neutral-50 border-none rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary-500"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="All">All Departments</option>
            {memberDepartments.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Member</th>
                <th className="px-6 py-4 font-semibold">Contact</th>
                <th className="px-6 py-4 font-semibold">Department</th>
                <th className="px-6 py-4 font-semibold">Group</th>
                <th className="px-6 py-4 font-semibold">Birthday</th>
                <th className="px-6 py-4 font-semibold">Joined</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sortedMembers.map((member) => (
                <tr key={member.id} className="hover:bg-neutral-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => openViewModal(member)}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
                      >
                        {member.photo_url ? (
                          <img 
                            src={member.photo_url} 
                            alt={`${member.first_name} ${member.last_name}`}
                            className="w-10 h-10 rounded-full object-cover border border-neutral-200"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
                            {member.first_name[0]}{member.last_name[0]}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors">
                            {member.first_name} {member.last_name}
                          </div>
                          <div className="text-xs text-neutral-500">{member.gender}</div>
                        </div>
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-neutral-700">{member.phone_number || 'N/A'}</div>
                    <div className="text-xs text-neutral-500">{member.email || 'No email'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-neutral-700">
                      {memberDepartments.find(d => d.id === member.department_id)?.name || (
                        <span className="text-neutral-400 italic">No Dept</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-neutral-700">
                      {memberGroups.find(g => g.id === member.group_id)?.name || (
                        <span className="text-neutral-400 italic">No Group</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-600">
                    {member.birthday ? format(new Date(member.birthday), 'MMM dd, yyyy') : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-600">
                    {format(new Date(member.date_joined), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-semibold",
                      member.status === 'Active' ? "bg-emerald-100 text-emerald-700" :
                      member.status === 'Inactive' ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"
                    )}>
                      {member.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openViewModal(member)}
                        className="p-2 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => openModal(member)}
                        className="p-2 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Edit Member"
                      >
                        <Edit2 size={18} />
                      </button>
                      {user?.role === 'admin' && (
                        <button 
                          onClick={() => handleDelete(member.id)}
                          className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Member"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-neutral-400">
                    <div className="flex flex-col items-center gap-2">
                      <Users size={48} className="text-neutral-200" />
                      <p>No members found matching your criteria.</p>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-neutral-900">
                {editingMember ? 'Edit Member' : 'Add New Member'}
              </h2>
              <button onClick={closeModal} className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-8">
              {/* Photo Upload */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-full bg-neutral-100 border-2 border-dashed border-neutral-300 flex items-center justify-center overflow-hidden">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User size={48} className="text-neutral-300" />
                    )}
                  </div>
                  <div className="absolute -bottom-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="p-2 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-colors"
                      title="Upload Photo"
                    >
                      <Camera size={20} />
                    </button>
                    {photoPreview && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="p-2 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition-colors"
                        title="Remove Photo"
                      >
                        <Trash size={20} />
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={photoInputRef}
                  onChange={handlePhotoChange}
                />
                <p className="text-xs text-neutral-500">Upload a profile photo (will be cropped to square)</p>
              </div>

              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wider">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">First Name *</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">Last Name *</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">Gender</label>
                    <select
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">Birthday</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.birthday}
                      onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">Marital Status</label>
                    <select
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.maritalStatus}
                      onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value as any })}
                    >
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Divorced">Divorced</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wider">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">Email Address</label>
                    <input
                      type="email"
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">Phone Number</label>
                    <input
                      type="tel"
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Residential Address</label>
                  <textarea
                    rows={2}
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
              </div>

              {/* Professional & Education */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wider">Professional & Education</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">Occupation</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.occupation}
                      onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">Education</label>
                    <select
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.education}
                      onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                    >
                      <option value="">Select education</option>
                      {educationOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Church Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wider">Church Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">Status</label>
                    <select
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Visitor">Visitor</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">Baptism Status</label>
                    <select
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.baptismStatus}
                      onChange={(e) => setFormData({ ...formData, baptismStatus: e.target.value as any })}
                    >
                      <option value="Not Baptized">Not Baptized</option>
                      <option value="Baptized">Baptized</option>
                    </select>
                  </div>
                  {formData.baptismStatus === 'Baptized' && (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-neutral-700">Baptism Date</label>
                      <input
                        type="date"
                        className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                        value={formData.baptismDate}
                        onChange={(e) => setFormData({ ...formData, baptismDate: e.target.value })}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">Membership Date</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.membershipDate}
                      onChange={(e) => setFormData({ ...formData, membershipDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">Date Joined</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.dateJoined}
                      onChange={(e) => setFormData({ ...formData, dateJoined: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">Ministry</label>
                    <select
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.ministry}
                      onChange={(e) => setFormData({ ...formData, ministry: e.target.value })}
                    >
                      <option value="">Select ministry</option>
                      {ministryOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">Department</label>
                    <select
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.departmentId}
                      onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    >
                      <option value="">No Department</option>
                      {memberDepartments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">Group</label>
                    <select
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.group}
                      onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                    >
                      <option value="">No Group</option>
                      {memberGroups.map(group => (
                        <option key={group.id} value={group.id}>{group.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Custom Fields */}
              {customFieldDefinitions.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wider">Additional Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {customFieldDefinitions.map((def) => (
                      <div key={def.id} className="space-y-2">
                        <label className="text-sm font-semibold text-neutral-700">
                          {def.name} {def.required && '*'}
                        </label>
                        {def.type === 'select' ? (
                          <select
                            required={def.required}
                            className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                            value={formData.customFields[def.id] || ''}
                            onChange={(e) => setFormData({
                              ...formData,
                              customFields: { ...formData.customFields, [def.id]: e.target.value }
                            })}
                          >
                            <option value="">Select {def.name}</option>
                            {def.options?.map((opt, i) => (
                              <option key={i} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : def.type === 'boolean' ? (
                          <div className="flex items-center gap-2 py-2">
                            <input
                              type="checkbox"
                              id={`custom-${def.id}`}
                              checked={formData.customFields[def.id] || false}
                              onChange={(e) => setFormData({
                                ...formData,
                                customFields: { ...formData.customFields, [def.id]: e.target.checked }
                              })}
                              className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                            />
                            <label htmlFor={`custom-${def.id}`} className="text-sm text-neutral-600">Yes / No</label>
                          </div>
                        ) : (
                          <input
                            required={def.required}
                            type={def.type === 'number' ? 'number' : def.type === 'date' ? 'date' : 'text'}
                            className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                            value={formData.customFields[def.id] || ''}
                            onChange={(e) => setFormData({
                              ...formData,
                              customFields: { ...formData.customFields, [def.id]: e.target.value }
                            })}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Emergency Contact */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wider">Emergency Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">Name</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.emergencyContact.name}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        emergencyContact: { ...formData.emergencyContact, name: e.target.value } 
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">Relationship</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.emergencyContact.relationship}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        emergencyContact: { ...formData.emergencyContact, relationship: e.target.value } 
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">Phone</label>
                    <input
                      type="tel"
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.emergencyContact.phone_number}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        emergencyContact: { ...formData.emergencyContact, phone_number: e.target.value } 
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700">Notes</label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
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
                  disabled={isUploading}
                  className="flex-1 py-3 px-6 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-100 disabled:opacity-50"
                >
                  {isUploading ? 'Uploading...' : (editingMember ? 'Save Changes' : 'Add Member')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* View Details Modal */}
      {isViewModalOpen && viewingMember && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-primary-50">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-4">
                  {viewingMember.photo_url ? (
                    <img 
                      src={viewingMember.photo_url} 
                      alt={`${viewingMember.first_name} ${viewingMember.last_name}`}
                      className="w-24 h-24 rounded-full object-cover shadow-sm border-2 border-white"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-white text-primary-600 flex items-center justify-center font-bold text-3xl shadow-sm border-2 border-primary-100">
                      {viewingMember.first_name[0]}{viewingMember.last_name[0]}
                    </div>
                  )}
                  <div>
                    <h2 className="text-3xl font-bold text-neutral-900">{viewingMember.first_name} {viewingMember.last_name}</h2>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-xs font-semibold",
                        viewingMember.status === 'Active' ? "bg-emerald-100 text-emerald-700" :
                        viewingMember.status === 'Inactive' ? "bg-red-100 text-red-700" :
                        "bg-amber-100 text-amber-700"
                      )}>
                        {viewingMember.status}
                      </span>
                      <span className="text-sm text-neutral-500">• {viewingMember.gender}</span>
                    </div>
                  </div>
                </div>
                <div className="flex bg-white/50 p-1 rounded-lg backdrop-blur-sm border border-white/20">
                  <button
                    onClick={() => setViewTab('profile')}
                    className={cn(
                      "px-3 py-1 text-xs font-bold rounded-md transition-all",
                      viewTab === 'profile' ? "bg-white text-primary-600 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                    )}
                  >
                    Profile
                  </button>
                  <button
                    onClick={() => setViewTab('tithes')}
                    className={cn(
                      "px-3 py-1 text-xs font-bold rounded-md transition-all",
                      viewTab === 'tithes' ? "bg-white text-primary-600 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                    )}
                  >
                    Tithes
                  </button>
                  <button
                    onClick={() => setViewTab('relationships')}
                    className={cn(
                      "px-3 py-1 text-xs font-bold rounded-md transition-all",
                      viewTab === 'relationships' ? "bg-white text-primary-600 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                    )}
                  >
                    Family
                  </button>
                  <button
                    onClick={() => setViewTab('attendance')}
                    className={cn(
                      "px-3 py-1 text-xs font-bold rounded-md transition-all",
                      viewTab === 'attendance' ? "bg-white text-primary-600 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                    )}
                  >
                    Attendance
                  </button>
                </div>
              </div>
              <button onClick={closeViewModal} className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg bg-white shadow-sm">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-10">
              {viewTab === 'profile' ? (
                <>
                  {/* Contact & Personal Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wider flex items-center gap-2">
                    <Phone size={16} /> Contact Details
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Mail size={18} className="text-neutral-400 mt-0.5" />
                      <div>
                        <div className="text-xs text-neutral-500 uppercase font-semibold">Email</div>
                        <div className="text-neutral-900">{viewingMember.email || 'N/A'}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Phone size={18} className="text-neutral-400 mt-0.5" />
                      <div>
                        <div className="text-xs text-neutral-500 uppercase font-semibold">Phone</div>
                        <div className="text-neutral-900">{viewingMember.phone_number || 'N/A'}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin size={18} className="text-neutral-400 mt-0.5" />
                      <div>
                        <div className="text-xs text-neutral-500 uppercase font-semibold">Address</div>
                        <div className="text-neutral-900">{viewingMember.address || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wider flex items-center gap-2">
                    <Calendar size={16} /> Personal Info
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Calendar size={18} className="text-neutral-400 mt-0.5" />
                      <div>
                        <div className="text-xs text-neutral-500 uppercase font-semibold">Birthday</div>
                        <div className="text-neutral-900">
                          {viewingMember.birthday ? format(new Date(viewingMember.birthday), 'MMMM dd, yyyy') : 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Heart size={18} className="text-neutral-400 mt-0.5" />
                      <div>
                        <div className="text-xs text-neutral-500 uppercase font-semibold">Marital Status</div>
                        <div className="text-neutral-900">{viewingMember.marital_status || 'N/A'}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Calendar size={18} className="text-neutral-400 mt-0.5" />
                      <div>
                        <div className="text-xs text-neutral-500 uppercase font-semibold">Date Joined</div>
                        <div className="text-neutral-900">
                          {format(new Date(viewingMember.date_joined), 'MMMM dd, yyyy')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Professional & Education */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wider flex items-center gap-2">
                    <Briefcase size={16} /> Professional
                  </h3>
                  <div className="flex items-start gap-3">
                    <Briefcase size={18} className="text-neutral-400 mt-0.5" />
                    <div>
                      <div className="text-xs text-neutral-500 uppercase font-semibold">Occupation</div>
                      <div className="text-neutral-900">{viewingMember.occupation || 'N/A'}</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wider flex items-center gap-2">
                    <GraduationCap size={16} /> Education
                  </h3>
                  <div className="flex items-start gap-3">
                    <GraduationCap size={18} className="text-neutral-400 mt-0.5" />
                    <div>
                      <div className="text-xs text-neutral-500 uppercase font-semibold">Education Level</div>
                      <div className="text-neutral-900">{viewingMember.education || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Church Involvement */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck size={16} /> Church Involvement
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-neutral-50 p-4 rounded-xl border border-neutral-100">
                  <div>
                    <div className="text-xs text-neutral-500 uppercase font-semibold">Baptism</div>
                    <div className="text-neutral-900 font-medium">
                      {viewingMember.baptism_status}
                      {viewingMember.baptism_date && (
                        <span className="text-xs text-neutral-400 block">
                          {format(new Date(viewingMember.baptism_date), 'MMM dd, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500 uppercase font-semibold">Membership Date</div>
                    <div className="text-neutral-900 font-medium">
                      {viewingMember.membership_date ? format(new Date(viewingMember.membership_date), 'MMMM dd, yyyy') : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500 uppercase font-semibold">Ministry</div>
                    <div className="text-neutral-900 font-medium">{viewingMember.ministry || 'None'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500 uppercase font-semibold">Department</div>
                    <div className="text-neutral-900 font-medium">
                      {memberDepartments.find(d => d.id === viewingMember.department_id)?.name || 'None'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500 uppercase font-semibold">Group</div>
                    <div className="text-neutral-900 font-medium">
                      {memberGroups.find(g => g.id === viewingMember.group_id)?.name || 'None'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Fields Section */}
              {customFieldDefinitions.length > 0 && (
                <div className="space-y-4 pt-6 border-t border-neutral-100">
                  <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wider flex items-center gap-2">
                    <ListPlus size={16} /> Additional Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {customFieldDefinitions.map(def => (
                      <div key={def.id} className="flex items-start gap-3">
                        <div className="p-2 bg-neutral-50 rounded-lg text-neutral-400">
                          <FileText size={18} />
                        </div>
                        <div>
                          <div className="text-xs text-neutral-500 uppercase font-semibold">{def.name}</div>
                          <div className="text-neutral-900 font-medium">
                            {def.type === 'boolean' 
                              ? (viewingMember.custom_fields?.[def.id] ? 'Yes' : 'No')
                              : (viewingMember.custom_fields?.[def.id]?.toString() || 'N/A')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Emergency Contact */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wider flex items-center gap-2">
                  <Users2 size={16} /> Emergency Contact
                </h3>
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-red-500 uppercase font-semibold">Name</div>
                    <div className="text-neutral-900 font-bold">{viewingMember.emergency_contact?.name || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-red-500 uppercase font-semibold">Relationship</div>
                    <div className="text-neutral-900">{viewingMember.emergency_contact?.relationship || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-red-500 uppercase font-semibold">Phone</div>
                    <div className="text-neutral-900 font-bold">{viewingMember.emergency_contact?.phone_number || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wider flex items-center gap-2">
                  <FileText size={16} /> Additional Notes
                </h3>
                <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 italic text-neutral-600 min-h-[80px]">
                  {viewingMember.note || 'No additional notes provided.'}
                </div>
              </div>
            </>
          ) : viewTab === 'tithes' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                  <ReceiptText size={20} className="text-primary-600" />
                  Tithes & Offerings History
                </h3>
                <div className="text-sm text-neutral-500">
                  Total: <span className="font-bold text-neutral-900">
                    ${memberTithes.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Tithe Chart */}
              {memberTithes.length > 0 && (
                <div className="h-64 w-full bg-neutral-50 rounded-2xl p-4 border border-neutral-100">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(() => {
                      const last6Months = Array.from({ length: 6 }).map((_, i) => {
                        const d = subMonths(new Date(), i);
                        return format(d, 'MMM yyyy');
                      }).reverse();
                      
                      return last6Months.map(month => {
                        const amount = memberTithes
                          .filter(t => format(new Date(t.date), 'MMM yyyy') === month)
                          .reduce((sum, t) => sum + t.amount, 0);
                        return { month, amount };
                      });
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                      <XAxis dataKey="month" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']}
                      />
                      <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {isLoadingTithes ? (
                <div className="py-20 text-center text-neutral-400">Loading tithes history...</div>
              ) : memberTithes.length > 0 ? (
                <div className="space-y-4">
                  {memberTithes.map((tithe) => (
                    <div key={tithe.id} className="flex items-center justify-between p-4 bg-white border border-neutral-100 rounded-xl hover:shadow-sm transition-all">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary-50 p-2 rounded-lg text-primary-600">
                          <DollarSign size={20} />
                        </div>
                        <div>
                          <div className="font-bold text-neutral-900">${tithe.amount.toLocaleString()}</div>
                          <div className="text-xs text-neutral-500">{format(new Date(tithe.date), 'MMMM dd, yyyy')}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{tithe.payment_method}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center text-neutral-400 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                  <ReceiptText size={48} className="mx-auto mb-4 text-neutral-200" />
                  <p>No tithes recorded for this member yet.</p>
                </div>
              )}
            </div>
          ) : viewTab === 'relationships' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                  <Link size={20} className="text-primary-600" />
                  Family & Relationships
                </h3>
                {user?.role === 'admin' && (
                  <button 
                    onClick={() => setIsRelationshipModalOpen(true)}
                    className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1 bg-primary-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus size={14} /> Add Relative
                  </button>
                )}
              </div>

              {isLoadingRelationships ? (
                <div className="py-20 text-center text-neutral-400">Loading relationships...</div>
              ) : memberRelationships.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {memberRelationships.map((rel) => (
                    <div key={rel.id} className="flex items-center gap-4 p-4 bg-white border border-neutral-100 rounded-2xl hover:shadow-md transition-all group">
                      {rel.related_member.photo_url ? (
                        <img 
                          src={rel.related_member.photo_url} 
                          alt={rel.related_member.first_name}
                          className="w-12 h-12 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center font-bold">
                          {rel.related_member.first_name[0]}{rel.related_member.last_name[0]}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="font-bold text-neutral-900">{rel.related_member.first_name} {rel.related_member.last_name}</div>
                        <div className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full inline-block mt-1">
                          {rel.relationship_type}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openViewModal(rel.related_member)}
                          className="p-2 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="View Profile"
                        >
                          <Eye size={18} />
                        </button>
                        {user?.role === 'admin' && (
                          <button 
                            onClick={() => handleDeleteRelationship(rel.id)}
                            className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove Relationship"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center text-neutral-400 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                  <Users size={48} className="mx-auto mb-4 text-neutral-200" />
                  <p>No family relationships recorded yet.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                  <History size={20} className="text-primary-600" />
                  Attendance History
                </h3>
              </div>

              {isLoadingAttendance ? (
                <div className="py-20 text-center text-neutral-400">Loading attendance...</div>
              ) : memberAttendance.length > 0 ? (
                <div className="space-y-4">
                  {memberAttendance.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-4 bg-white border border-neutral-100 rounded-xl hover:shadow-sm transition-all">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "p-2 rounded-lg",
                          record.status === 'Present' ? "bg-emerald-50 text-emerald-600" :
                          record.status === 'Absent' ? "bg-red-50 text-red-600" :
                          "bg-amber-50 text-amber-600"
                        )}>
                          <Activity size={20} />
                        </div>
                        <div>
                          <div className="font-bold text-neutral-900">{record.attendance.service_type}</div>
                          <div className="text-xs text-neutral-500">{format(new Date(record.attendance.date), 'MMMM dd, yyyy')}</div>
                        </div>
                      </div>
                      <div className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold",
                        record.status === 'Present' ? "bg-emerald-100 text-emerald-700" :
                        record.status === 'Absent' ? "bg-red-100 text-red-700" :
                        "bg-amber-100 text-amber-700"
                      )}>
                        {record.status}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center text-neutral-400 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                  <Activity size={48} className="mx-auto mb-4 text-neutral-200" />
                  <p>No attendance records found for this member.</p>
                </div>
              )}
            </div>
          )}
        </div>
            
            <div className="p-6 border-t border-neutral-100 bg-neutral-50 flex justify-end">
              <button
                onClick={closeViewModal}
                className="px-8 py-2 bg-white text-neutral-600 border border-neutral-200 rounded-xl font-semibold hover:bg-neutral-100 transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Group Management Modal */}
      {isGroupModalOpen && (
        <GroupManagementModal 
          groups={memberGroups} 
          members={members}
          onClose={() => setIsGroupModalOpen(false)} 
        />
      )}

      {/* Department Management Modal */}
      {isDepartmentModalOpen && (
        <DepartmentManagementModal 
          departments={memberDepartments} 
          members={members}
          onClose={() => setIsDepartmentModalOpen(false)} 
        />
      )}

      {/* Relationship Modal */}
      {isRelationshipModalOpen && viewingMember && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-neutral-900">Add Family Relationship</h2>
              <button 
                onClick={() => setIsRelationshipModalOpen(false)} 
                className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddRelationship} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700">Select Family Member</label>
                <select
                  required
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                  value={relationshipFormData.relatedMemberId}
                  onChange={(e) => setRelationshipFormData({ ...relationshipFormData, relatedMemberId: e.target.value })}
                >
                  <option value="">Select a member...</option>
                  {members
                    .filter(m => m.id !== viewingMember.id)
                    .map(m => (
                      <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                    ))
                  }
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700">Relationship Type</label>
                <select
                  required
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                  value={relationshipFormData.relationshipType}
                  onChange={(e) => setRelationshipFormData({ ...relationshipFormData, relationshipType: e.target.value as any })}
                >
                  <option value="Spouse">Spouse</option>
                  <option value="Parent">Parent</option>
                  <option value="Child">Child</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsRelationshipModalOpen(false)}
                  className="flex-1 py-2 px-4 bg-neutral-100 text-neutral-600 rounded-xl font-semibold hover:bg-neutral-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
                >
                  Add Relationship
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Cropping Modal */}
      {isCropping && tempPhotoUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-900">Crop Profile Photo</h2>
              <button 
                onClick={() => {
                  setIsCropping(false);
                  setTempPhotoUrl(null);
                }} 
                className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="relative h-[400px] bg-neutral-900">
              <Cropper
                image={tempPhotoUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-neutral-600">
                  <span>Zoom</span>
                  <span>{zoom.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsCropping(false);
                    setTempPhotoUrl(null);
                  }}
                  className="flex-1 py-2.5 bg-neutral-100 text-neutral-600 rounded-xl font-semibold hover:bg-neutral-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCropSave}
                  className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
                >
                  Save Crop
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Fields Modal */}
      <CustomFieldsModal
        isOpen={isCustomFieldsModalOpen}
        onClose={() => setIsCustomFieldsModalOpen(false)}
        definitions={customFieldDefinitions}
        onSave={fetchCustomFieldDefinitions}
      />
    </div>
  );
}

function DepartmentManagementModal({ departments, members, onClose }: { departments: MemberDepartment[], members: Member[], onClose: () => void }) {
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptDesc, setNewDeptDesc] = useState('');
  const [editingDept, setEditingDept] = useState<MemberDepartment | null>(null);

  const getMemberCount = (deptId: string) => {
    return members.filter(m => m.department_id === deptId).length;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDept) {
        const { error } = await supabase
          .from('member_departments')
          .update({
            name: newDeptName,
            description: newDeptDesc
          })
          .eq('id', editingDept.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('member_departments')
          .insert([{
            name: newDeptName,
            description: newDeptDesc
          }]);
        if (error) throw error;
      }
      setNewDeptName('');
      setNewDeptDesc('');
      setEditingDept(null);
    } catch (error) {
      handleDatabaseError(error, editingDept ? OperationType.UPDATE : OperationType.CREATE, 'member_departments');
    }
  };

  const handleEdit = (dept: MemberDepartment) => {
    setEditingDept(dept);
    setNewDeptName(dept.name);
    setNewDeptDesc(dept.description || '');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this department? Members in this department will remain but will no longer be assigned to it.')) return;
    try {
      const { error } = await supabase
        .from('member_departments')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      handleDatabaseError(error, OperationType.DELETE, 'member_departments');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-neutral-900">Manage Departments</h2>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4 bg-neutral-50 p-4 rounded-xl border border-neutral-100">
            <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider">
              {editingDept ? 'Edit Department' : 'Add New Department'}
            </h3>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-500">Department Name</label>
              <input
                required
                type="text"
                className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="e.g., Ushering, Media, Welfare"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-500">Description (Optional)</label>
              <textarea
                rows={2}
                className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                placeholder="What is this department for?"
                value={newDeptDesc}
                onChange={(e) => setNewDeptDesc(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {editingDept && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingDept(null);
                    setNewDeptName('');
                    setNewDeptDesc('');
                  }}
                  className="flex-1 py-2 px-4 bg-neutral-200 text-neutral-600 rounded-xl font-semibold hover:bg-neutral-300 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
              >
                {editingDept ? 'Update' : 'Add Department'}
              </button>
            </div>
          </form>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider">Existing Departments</h3>
            <div className="space-y-2">
              {departments.map((dept) => (
                <div key={dept.id} className="flex items-center justify-between p-3 bg-white border border-neutral-100 rounded-xl hover:shadow-sm transition-all group">
                  <div>
                    <div className="font-bold text-neutral-900">{dept.name}</div>
                    {dept.description && <div className="text-xs text-neutral-500">{dept.description}</div>}
                    <div className="text-[10px] text-primary-600 font-bold mt-1 uppercase tracking-tighter">
                      {getMemberCount(dept.id)} Members
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(dept)}
                      className="p-1.5 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(dept.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {departments.length === 0 && (
                <div className="text-center py-8 text-neutral-400 text-sm italic">
                  No departments created yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupManagementModal({ groups, members, onClose }: { groups: MemberGroup[], members: Member[], onClose: () => void }) {
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [editingGroup, setEditingGroup] = useState<MemberGroup | null>(null);

  const getMemberCount = (groupId: string) => {
    return members.filter(m => m.group_id === groupId).length;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingGroup) {
        const { error } = await supabase
          .from('member_groups')
          .update({
            name: newGroupName,
            description: newGroupDesc
          })
          .eq('id', editingGroup.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('member_groups')
          .insert([{
            name: newGroupName,
            description: newGroupDesc
          }]);
        if (error) throw error;
      }
      setNewGroupName('');
      setNewGroupDesc('');
      setEditingGroup(null);
    } catch (error) {
      handleDatabaseError(error, editingGroup ? OperationType.UPDATE : OperationType.CREATE, 'member_groups');
    }
  };

  const handleEdit = (group: MemberGroup) => {
    setEditingGroup(group);
    setNewGroupName(group.name);
    setNewGroupDesc(group.description || '');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this group? Members in this group will remain but will no longer be assigned to it.')) return;
    try {
      const { error } = await supabase
        .from('member_groups')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      handleDatabaseError(error, OperationType.DELETE, 'member_groups');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-neutral-900">Manage Groups</h2>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4 bg-neutral-50 p-4 rounded-xl border border-neutral-100">
            <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider">
              {editingGroup ? 'Edit Group' : 'Add New Group'}
            </h3>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-500">Group Name</label>
              <input
                required
                type="text"
                className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="e.g., Choir, Youth, Elders"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-500">Description (Optional)</label>
              <textarea
                rows={2}
                className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                placeholder="What is this group for?"
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {editingGroup && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingGroup(null);
                    setNewGroupName('');
                    setNewGroupDesc('');
                  }}
                  className="flex-1 py-2 px-4 bg-neutral-200 text-neutral-600 rounded-xl font-semibold hover:bg-neutral-300 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
              >
                {editingGroup ? 'Update' : 'Add Group'}
              </button>
            </div>
          </form>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider">Existing Groups</h3>
            <div className="space-y-2">
              {groups.map((group) => (
                <div key={group.id} className="flex items-center justify-between p-3 bg-white border border-neutral-100 rounded-xl hover:shadow-sm transition-all">
                  <div>
                    <div className="font-semibold text-neutral-900">{group.name}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                        {getMemberCount(group.id)} members
                      </span>
                      {group.description && <span className="text-xs text-neutral-500">• {group.description}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(group)}
                      className="p-1.5 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(group.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {groups.length === 0 && (
                <div className="text-center py-8 text-neutral-400 text-sm">
                  No groups created yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to crop the image
async function getCroppedImg(imageSrc: string, pixelCrop: any): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (error) => reject(error));
    img.setAttribute('crossOrigin', 'anonymous');
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas is empty'));
        return;
      }
      resolve(blob);
    }, 'image/jpeg');
  });
}
