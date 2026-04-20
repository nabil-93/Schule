export type Role = 'director' | 'admin' | 'teacher' | 'parent' | 'student' | 'staff';

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  language: 'fr' | 'en' | 'de' | 'ar';
  avatarUrl?: string;
  address?: string;
  bio?: string;
}

export interface Student {
  id: string;
  fullName: string;
  email: string;
  classId: string | null;
  parentName: string;
  dateOfBirth: string;
  admissionNo: string;
  attendanceRate: number;
  feesStatus: 'paid' | 'due' | 'partial';
  status: 'active' | 'new' | 'scholarship' | 'inactive';
  avatarUrl?: string;
}

export interface Teacher {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  employeeNo: string;
  specialization: string;
  joinDate: string;
  subjectIds: string[];
  status: 'active' | 'leave' | 'inactive';
  avatarUrl?: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  level: string;
  room: string;
  capacity: number;
  homeroomTeacherId: string | null;
  academicYear: string;
}

export type WeekDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface ScheduleSession {
  id: string;
  day: WeekDay;
  startTime: string; // "HH:mm"
  endTime: string;
  subject: string;
  teacherId: string | null;
  classId: string | null;
  room: string;
}

export type ExamType = 'quiz' | 'midterm' | 'final';

export interface Exam {
  id: string;
  subject: string;
  classId: string;
  date: string; // ISO date
  type: ExamType;
  totalPoints: number;
  coefficient: number;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
}

export interface ExamSubmission {
  id: string;
  examId: string;
  studentId: string;
  answerText?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
  submittedAt?: string | null;
  gradeStatus: 'pending' | 'graded';
}

export interface ExamResult {
  id: string;
  examId: string;
  studentId: string;
  score: number;
}

export type InvoiceStatus = 'paid' | 'pending' | 'overdue';

export interface Invoice {
  id: string;
  studentId: string;
  amount: number;
  dueDate: string;
  issuedAt: string;
  paidAt: string | null;
  status: InvoiceStatus;
  note?: string;
}

export type NotificationType = 'info' | 'success' | 'warning' | 'danger';
export type NotificationCategory = 'system' | 'message' | 'announcement' | 'ticket' | 'billing';

export interface AppNotification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  createdAt: string; // ISO datetime
  read: boolean;
  link?: string;
}

export type Audience = 'all' | 'teachers' | 'students' | 'parents' | 'staff';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  authorId: string;
  createdAt: string;
  pinned: boolean;
}

export interface ChatContact {
  id: string;
  fullName: string;
  role: Role;
  avatarUrl?: string;
}

export interface ChatThread {
  id: string;
  contactId: string;
  lastMessageAt: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string; // contactId or 'me'
  body: string;
  createdAt: string;
  read: boolean;
}

export type TicketStatus = 'open' | 'pending' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high';
export type TicketCategory = 'technical' | 'billing' | 'academic' | 'other';

export interface Ticket {
  id: string;
  subject: string;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  assignedTo: string | null;
}

export interface TicketReply {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface SchoolInfo {
  name: string;
  academicYear: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface NotificationPreferences {
  message: boolean;
  announcement: boolean;
  ticket: boolean;
  billing: boolean;
  system: boolean;
}

export interface SecurityPreferences {
  twoFactorEnabled: boolean;
  loginAlerts: boolean;
  sessionTimeoutMin: number;
}
