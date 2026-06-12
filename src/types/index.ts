// TypeScript interfaces for DesignVault data models

export type UserRole = "designer" | "client";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  createdAt: Date;
  googleDriveConnected?: boolean;
  googleDriveTokens?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
}

export type ProjectStatus =
  | "Project Created"
  | "Planning"
  | "Designing"
  | "Client Review"
  | "Revision Requested"
  | "Final Delivery"
  | "Completed"
  | "Archived";

export type ProjectPriority = "Low" | "Medium" | "High" | "Urgent";

export interface Milestone {
  id: string;
  title: string;
  dueDate: Date;
  completed: boolean;
}

export interface Project {
  id: string;
  designerId: string;
  clientId: string;
  title: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  dueDate: Date;
  driveFolderId?: string;
  driveFolderUrl?: string;
  tags: string[];
  milestones: Milestone[];
  createdAt: Date;
  updatedAt: Date;
  thumbnailUrl?: string;
}

export interface Client {
  id: string;
  designerId: string;
  name: string;
  email: string;
  companyName?: string;
  avatar?: string;
  slug: string;
  createdAt: Date;
  totalProjects?: number;
  activeProjects?: number;
}

export type FileStatus = "Pending Review" | "Approved" | "Changes Requested" | "Final";

export interface ProjectFile {
  id: string;
  projectId: string;
  driveFileId: string;
  driveThumbnailUrl?: string;
  driveDownloadUrl?: string;
  driveViewUrl?: string;
  name: string;
  mimeType: string;
  size: number;
  version: number;
  status: FileStatus;
  uploadedBy: string;
  uploadedAt: Date;
  designerNotes?: string;
  changelog?: string;
  previousVersionId?: string;
}

export interface Comment {
  id: string;
  projectId: string;
  fileId?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: Date;
  resolved: boolean;
  parentId?: string;
  replies?: Comment[];
  mentions?: string[];
}

export type ActivityAction =
  | "UPLOADED_FILE"
  | "APPROVED_DESIGN"
  | "REQUESTED_CHANGES"
  | "LEFT_COMMENT"
  | "RESOLVED_COMMENT"
  | "DOWNLOADED_FILE"
  | "UPDATED_STATUS"
  | "CREATED_PROJECT"
  | "ADDED_MILESTONE"
  | "SENT_INVOICE"
  | "PAYMENT_RECEIVED";

export interface Activity {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: ActivityAction;
  timestamp: Date;
  details: Record<string, string | number | boolean>;
}

export type PaymentStatus = "Pending" | "Partial" | "Paid" | "Overdue";

export interface Invoice {
  id: string;
  projectId: string;
  designerId: string;
  clientId: string;
  amount: number;
  amountPaid: number;
  currency: string;
  status: PaymentStatus;
  dueDate: Date;
  description: string;
  upiId?: string;
  createdAt: Date;
  paidAt?: Date;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "file" | "comment" | "approval" | "payment" | "revision" | "system";
  read: boolean;
  projectId?: string;
  createdAt: Date;
  actionUrl?: string;
}
