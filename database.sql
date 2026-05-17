CREATE DATABASE IF NOT EXISTS `quanlynhatro` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `quanlynhatro`;

CREATE TABLE IF NOT EXISTS systemConfigs (
  id VARCHAR(255) PRIMARY KEY,
  propertyName VARCHAR(255),
  electricityPrice DOUBLE DEFAULT 0,
  waterPrice DOUBLE DEFAULT 0,
  internetPrice DOUBLE DEFAULT 0,
  trashPrice DOUBLE DEFAULT 0,
  bankName VARCHAR(255),
  bankAccount VARCHAR(255),
  bankAccountName VARCHAR(255),
  bankQrUrl TEXT,
  bankHubApiKey TEXT,
  bankHubSecret TEXT,
  smtpHost VARCHAR(255),
  smtpPort INT DEFAULT 587,
  smtpUser VARCHAR(255),
  smtpPass VARCHAR(255),
  smtpFrom VARCHAR(255),
  updatedAt DATETIME
);

CREATE TABLE IF NOT EXISTS rooms (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  normalizedName VARCHAR(255),
  area DOUBLE DEFAULT 0,
  price DOUBLE DEFAULT 0,
  status VARCHAR(50) DEFAULT 'AVAILABLE',
  tenantId VARCHAR(255),
  imageUrl TEXT,
  description TEXT,
  createdAt DATETIME,
  updatedAt DATETIME
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255),
  role VARCHAR(50),
  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  idCard VARCHAR(50),
  status VARCHAR(50) DEFAULT 'ACTIVE',
  roomId VARCHAR(255),
  tenantId VARCHAR(255),
  createdAt DATETIME,
  updatedAt DATETIME
);

-- Junction table for users -> rooms (since user roomIds was an array)
CREATE TABLE IF NOT EXISTS user_rooms (
  userId VARCHAR(255),
  roomId VARCHAR(255),
  PRIMARY KEY (userId, roomId),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  idCard VARCHAR(50),
  phone VARCHAR(50),
  address TEXT,
  email VARCHAR(255),
  roomId VARCHAR(255),
  createdAt DATETIME,
  updatedAt DATETIME,
  FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS contracts (
  id VARCHAR(255) PRIMARY KEY,
  roomId VARCHAR(255),
  tenantId VARCHAR(255),
  startDate DATETIME,
  endDate DATETIME,
  deposit DOUBLE DEFAULT 0,
  status VARCHAR(50) DEFAULT 'ACTIVE',
  createdAt DATETIME,
  updatedAt DATETIME,
  FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE SET NULL,
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(255) PRIMARY KEY,
  code VARCHAR(100),
  roomId VARCHAR(255),
  tenantId VARCHAR(255),
  month VARCHAR(20),
  roomPrice DOUBLE DEFAULT 0,
  electricityCost DOUBLE DEFAULT 0,
  waterCost DOUBLE DEFAULT 0,
  internetCost DOUBLE DEFAULT 0,
  trashCost DOUBLE DEFAULT 0,
  otherCosts DOUBLE DEFAULT 0,
  total DOUBLE DEFAULT 0,
  status VARCHAR(50),
  dueDate DATETIME,
  createdAt DATETIME,
  updatedAt DATETIME,
  FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE SET NULL,
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS utility_readings (
  id VARCHAR(255) PRIMARY KEY,
  roomId VARCHAR(255),
  month VARCHAR(20),
  electricityIndex DOUBLE DEFAULT 0,
  waterIndex DOUBLE DEFAULT 0,
  previousElectricityIndex DOUBLE DEFAULT 0,
  previousWaterIndex DOUBLE DEFAULT 0,
  electricityPrice DOUBLE DEFAULT 0,
  waterPrice DOUBLE DEFAULT 0,
  createdAt DATETIME,
  updatedAt DATETIME,
  FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(255) PRIMARY KEY,
  userId VARCHAR(255),
  senderId VARCHAR(255),
  title VARCHAR(255),
  content TEXT,
  type VARCHAR(50),
  isRead BOOLEAN DEFAULT FALSE,
  invoiceId VARCHAR(255),
  roomId VARCHAR(255),
  createdAt DATETIME,
  updatedAt DATETIME
);

CREATE TABLE IF NOT EXISTS passwordResets (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL,
  expiresAt DATETIME NOT NULL
);

-- Seed default admin if missing (using UUID format matching standard API generation)
INSERT INTO users (id, username, password, role, name, status, createdAt, updatedAt) 
SELECT 'admin-uuid-0000-0000', 'admin', '$2b$10$XtLxDaWDdoWEkZGGcZjTheVYZu74ePq6ekUhSrAGr4dDGtEzs0Ug.', 'ADMIN', 'Quản trị viên', 'ACTIVE', NOW(), NOW()
WHERE NOT EXISTS (SELECT id FROM users WHERE role = 'ADMIN');
