import type {
  Announcement,
  AppNotification,
  ChatContact,
  ChatMessage,
  ChatThread,
  Invoice,
  NotificationPreferences,
  ScheduleSession,
  SchoolClass,
  SchoolInfo,
  SecurityPreferences,
  Student,
  Teacher,
  Ticket,
  TicketReply,
  User,
} from '@/types';

export const seedUser: User = {
  id: 'u-1',
  fullName: 'Admin Nabil',
  email: 'nab.ouhaddou@gmail.com',
  phone: '+212 600 000 000',
  role: 'director',
  language: 'fr',
  address: 'Casablanca, Maroc',
  bio: "Directeur d'école — gestion pédagogique et administrative.",
};

export const seedClasses: SchoolClass[] = [];

export const seedTeachers: Teacher[] = [];

export const seedStudents: Student[] = [];

export const seedSchedule: ScheduleSession[] = [];

export const seedInvoices: Invoice[] = [];

export const seedNotifications: AppNotification[] = [];

export const seedContacts: ChatContact[] = [];

export const seedChatThreads: ChatThread[] = [];

export const seedChatMessages: ChatMessage[] = [];

export const seedAnnouncements: Announcement[] = [];

export const seedTickets: Ticket[] = [];

export const seedSchoolInfo: SchoolInfo = {
  name: 'École Al Manara',
  academicYear: '2025-2026',
  address: '12 Avenue Mohammed V, Casablanca',
  phone: '+212 522 000 000',
  email: 'contact@al-manara.ma',
};

export const seedNotificationPrefs: NotificationPreferences = {
  message: true,
  announcement: true,
  ticket: true,
  billing: true,
  system: false,
};

export const seedSecurityPrefs: SecurityPreferences = {
  twoFactorEnabled: false,
  loginAlerts: true,
  sessionTimeoutMin: 30,
};

export const seedTicketReplies: TicketReply[] = [];
