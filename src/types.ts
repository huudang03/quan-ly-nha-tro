
export type Role = 'ADMIN' | 'TENANT';

export interface User {
  id: string;
  username: string;
  password?: string;
  oldPassword?: string;
  role: Role;
  name: string;
  email: string;
  phone: string;
  address: string;
  idCard?: string;
  status: 'ACTIVE' | 'LOCKED';
  roomIds?: string[]; // For tenants
  tenantId?: string; // Link to Tenant object
  createdAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  senderId?: string;
  title: string;
  content: string;
  type: 'INVOICE' | 'CONTRACT' | 'PAYMENT' | 'SYSTEM';
  isRead: boolean;
  createdAt: string;
  invoiceId?: string;
  roomId?: string;
}

export interface SystemConfig {
  propertyName?: string;
  electricityPrice: number;
  waterPrice: number;
  internetPrice: number;
  trashPrice: number;
  bankName?: string;
  bankAccount?: string;
  bankAccountName?: string;
  bankQrUrl?: string;
  bankHubApiKey?: string;
  bankHubSecret?: string;
  // SMTP Configuration
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
}

export interface Room {
  id: string;
  name: string;
  area: number;
  price: number;
  status: 'AVAILABLE' | 'OCCUPIED';
  tenantId?: string;
  imageUrl?: string;
  description?: string;
}

export interface Tenant {
  id: string;
  name: string;
  idCard: string;
  phone: string;
  address: string;
  email?: string;
  roomId?: string;
}

export interface Contract {
  id: string;
  roomId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  deposit: number;
  status: 'ACTIVE' | 'EXPIRED' | 'TERMINATED';
}

export interface UtilityReading {
  id: string;
  roomId: string;
  month: string; // YYYY-MM
  electricityIndex: number;
  waterIndex: number;
  previousElectricityIndex: number;
  previousWaterIndex: number;
  electricityPrice: number;
  waterPrice: number;
  createdAt?: string;
}

export interface Invoice {
  id: string;
  code?: string;
  roomId: string;
  tenantId: string;
  month: string;
  roomPrice: number;
  electricityCost: number;
  waterCost: number;
  internetCost: number;
  trashCost: number;
  otherCosts: number;
  total: number;
  status: 'PAID' | 'UNPAID' | 'OVERDUE' | 'PENDING';
  createdAt: string;
  dueDate: string;
}
