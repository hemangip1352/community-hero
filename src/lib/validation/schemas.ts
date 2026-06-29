import { z } from 'zod';

export const reportIssueSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  category: z.enum([
    'Pothole',
    'Garbage',
    'Water Leakage',
    'Streetlight Failure',
    'Drainage Problem',
    'Road Damage',
    'Other',
  ]),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  image_base64: z.string().optional(),
  mime_type: z.string().optional(),
});

export const verifyIssueSchema = z.object({
  issue_id: z.string().uuid(),
  verification_type: z.enum(['ai', 'community']),
  status: z.enum(['confirmed', 'rejected', 'pending']),
  confidence_score: z.number().min(0).max(1).optional(),
  evidence_url: z.string().url().optional(),
  reasoning: z.string().optional(),
});

export const addCommentSchema = z.object({
  issue_id: z.string().uuid(),
  comment: z.string().min(1).max(1000),
});

export const updateIssueStatusSchema = z.object({
  status: z.enum(['reported', 'verified', 'assigned', 'in_progress', 'resolved', 'rejected', 'duplicate']),
  reason: z.string().optional(),
});

export const createAssignmentSchema = z.object({
  issue_id: z.string().uuid(),
  department_id: z.string().uuid(),
  assigned_to_user_id: z.string().uuid().optional(),
  assignment_reason: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().optional(),
  role: z.enum(['citizen', 'verifier', 'officer', 'senior_authority']),
});

export type ReportIssueInput = z.infer<typeof reportIssueSchema>;
export type VerifyIssueInput = z.infer<typeof verifyIssueSchema>;
export type AddCommentInput = z.infer<typeof addCommentSchema>;
export type UpdateIssueStatusInput = z.infer<typeof updateIssueStatusSchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
