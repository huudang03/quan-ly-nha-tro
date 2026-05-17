import { Room, Tenant, User, SystemConfig, UtilityReading } from './types';

export const INITIAL_ROOMS: Room[] = [];

export const INITIAL_READINGS: UtilityReading[] = [];

export const INITIAL_TENANTS: Tenant[] = [];

export const MOCK_USERS: User[] = [
  { 
    id: 'U1', 
    username: 'admin', 
    password: 'admin123', 
    role: 'ADMIN', 
    name: 'Administrator', 
    email: 'admin@example.com', 
    phone: '0123456789', 
    address: 'Hanoi', 
    status: 'ACTIVE' 
  }
];

export const INITIAL_CONFIG: SystemConfig = {
  electricityPrice: 3500,
  waterPrice: 15000,
  internetPrice: 100000,
  trashPrice: 30000,
  bankName: 'MB Bank',
  bankAccount: '0123456789',
  bankAccountName: 'NGUYEN VAN A'
};
