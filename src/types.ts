export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role: 'admin' | 'staff';
  created_at: string;
}

export type StaffPosition =
  | 'Senior pastor'
  | 'Assistant pastor'
  | 'Department head'
  | 'Church secretary'
  | 'Church treasurer'
  | 'Church usher leader'
  | 'Church choir leader'
  | 'Church prayer leader'
  | 'Church evangelism leader'
  | 'Church media leader'
  | 'Church welfare leader'
  | 'Church other leader'
  | 'Ministry leader';

export interface StaffMember {
  id: string;
  full_name: string;
  position: StaffPosition;
  department: string;
  ministry: string;
  email: string;
  phone?: string | null;
  bio?: string | null;
  photo_url?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone_number?: string;
  address?: string;
  gender: 'Male' | 'Female' | 'Other';
  birthday?: string;
  date_joined: string;
  status: 'Active' | 'Inactive' | 'Visitor';
  marital_status?: 'Single' | 'Married' | 'Widowed' | 'Divorced';
  occupation?: string;
  education?: string;
  baptism_status?: 'Baptized' | 'Not Baptized';
  baptism_date?: string;
  membership_date?: string;
  ministry?: string;
  department?: string;
  department_id?: string;
  group_id?: string;
  emergency_contact?: {
    name: string;
    relationship: string;
    phone_number: string;
  };
  note?: string;
  photo_url?: string;
  custom_fields?: Record<string, any>;
  created_at: string;
}

export interface CustomFieldDefinition {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options?: string[];
  required: boolean;
  created_at: string;
}

export interface Tithe {
  id: string;
  member_id: string;
  member_name: string;
  amount: number;
  date: string;
  payment_method: 'Cash' | 'Check' | 'Bank Transfer' | 'Mobile Money';
  recorded_by: string;
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  date: string;
  service_id: string;
  service?: Service;
  total_count: number;
  male_count?: number;
  female_count?: number;
  children_count?: number;
  recorded_by: string;
  created_at: string;
}

export interface Finance {
  id: string;
  type: 'Income' | 'Expense';
  category: string;
  amount: number;
  date: string;
  description: string;
  recorded_by: string;
  created_at: string;
}

export interface FinanceCategory {
  id: string;
  name: string;
  type: 'Income' | 'Expense';
  created_at: string;
}

export interface MemberGroup {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface MemberDepartment {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface MemberRelationship {
  id: string;
  member_id: string;
  related_member_id: string;
  relationship_type: 'Spouse' | 'Parent' | 'Child' | 'Sibling' | 'Other';
  created_at: string;
}

export interface MemberAttendance {
  id: string;
  member_id: string;
  attendance_id: string;
  status: 'Present' | 'Absent' | 'Excused';
  created_at: string;
}

export interface ChurchEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  category: 'Service' | 'Youth' | 'Outreach' | 'Special' | 'Meeting' | 'Other';
  status: 'Upcoming' | 'Ongoing' | 'Completed' | 'Cancelled';
  organizer: string;
  recurrence_type: 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
  recurrence_interval: number;
  recurrence_end_date?: string;
  created_at: string;
  updated_at: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface DatabaseErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
