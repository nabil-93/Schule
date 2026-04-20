import type { Role } from '@/types';

/**
 * Role-aware messaging visibility rules. Enforced server-side before starting a conversation
 * or sending a message. RLS remains the hard boundary — this is the product-level policy.
 *
 * Director/admin (staff) can message anyone.
 * Teachers can message staff, other teachers, students and parents.
 * Parents can message staff and teachers only.
 * Students can message staff and teachers only.
 */
export function canMessage(from: Role, to: Role): boolean {
  if (from === to && (from === 'parent' || from === 'student')) return false;
  if (from === 'director' || from === 'admin') return true;
  if (to === 'director' || to === 'admin') return true;

  if (from === 'teacher') {
    return to === 'teacher' || to === 'student' || to === 'parent';
  }
  if (from === 'parent') {
    return to === 'teacher';
  }
  if (from === 'student') {
    return to === 'teacher';
  }
  return false;
}

export function isStaffRole(role: Role): boolean {
  return role === 'director' || role === 'admin';
}
