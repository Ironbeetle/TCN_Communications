# TCN Communications - Electron Migration Reference Guide

> **Purpose**: This document provides all the context and information needed to rebuild the TCN Communications web app as an Electron desktop application.

---

## Table of Contents

1. [Application Overview](#application-overview)
2. [Database Schema](#database-schema)
3. [Page Structure & Routing](#page-structure--routing)
4. [External API Integrations](#external-api-integrations)
5. [Authentication System](#authentication-system)
6. [Component Architecture](#component-architecture)
7. [Environment Variables](#environment-variables)
8. [Electron-Specific Considerations](#electron-specific-considerations)

---

## Application Overview

### What the App Does
TCN Communications is a **staff communication management system** for a First Nation band office that allows:

- **SMS Messaging** - Send bulk SMS to community members via Twilio
- **Email Campaigns** - Send emails with attachments via Resend
- **Bulletin Creation** - Post bulletins to the community portal
- **Sign-Up Forms** - Create and manage community sign-up forms
- **User Management** - Admin controls for staff accounts
- **Activity Logging** - Track all communications sent

### Tech Stack (Current)
| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Database | PostgreSQL via Prisma |
| Auth | NextAuth.js (JWT) |
| SMS | Twilio API |
| Email | Resend API |
| UI | Tailwind CSS, shadcn/ui |
| Portal Sync | REST API to TCN Portal |

### Tech Stack (Electron Target)
| Layer | Recommendation |
|-------|----------------|
| Framework | Electron + React |
| Database | SQLite via Prisma (or keep PostgreSQL remote) |
| Auth | Local auth (simpler, no cookies) |
| SMS | Twilio API (same) |
| Email | Resend API (same) |
| UI | Tailwind CSS, shadcn/ui (same) |
| Portal Sync | REST API (same) |

---

## Database Schema

### Schema Location
`prisma/schema.prisma`

### Database Configuration
```prisma
datasource db {
  provider = "postgresql"  // Change to "sqlite" for local desktop
  url      = env("DATABASE_URL")
  schemas  = ["msgmanager"]
}
```

### Models

#### User (Staff Accounts)
```prisma
model User {
  id            String         @id @default(cuid())
  email         String         @unique
  password      String         // bcrypt hashed
  first_name    String
  last_name     String
  created       DateTime       @default(now())
  updated       DateTime       @updatedAt
  department    Department     @default(BAND_OFFICE)
  role          UserRole       @default(STAFF)
  
  // Authentication
  pin           String?        // 6-digit PIN for password reset
  pinExpiresAt  DateTime?
  lastLogin     DateTime?
  loginAttempts Int            @default(0)
  lockedUntil   DateTime?      // Account lockout
  
  // Password reset tracking
  passwordResetRequested DateTime?
  passwordResetCompleted DateTime?

  // Relations
  emails        EmailLog[]
  staffemail    StaffEmailLog[]
  bulletin      BulletinApiLog[]
  sessions      Session[]
  smslog        SmsLog[]
  msgcnc        MsgCnC[]
  loginLogs     LoginLog[]
}
```

#### Enums
```prisma
enum UserRole {
  STAFF
  STAFF_ADMIN
  ADMIN
  CHIEF_COUNCIL
}

enum Department {
  BAND_OFFICE
  J_W_HEALTH_CENTER
  CSCMEC
  COUNCIL
  RECREATION
  UTILITIES
}

enum Categories {
  CHIEFNCOUNCIL
  HEALTH
  EDUCATION
  RECREATION
  EMPLOYMENT
  PROGRAM_EVENTS
  ANNOUNCEMENTS
}

enum FieldType {
  TEXT
  TEXTAREA
  SELECT
  MULTISELECT
  CHECKBOX
  DATE
  NUMBER
  EMAIL
  PHONE
}
```

#### LoginLog (Audit Trail)
```prisma
model LoginLog {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(...)
  loginTime   DateTime  @default(now())
  department  Department
  ipAddress   String?
  userAgent   String?
  success     Boolean   @default(true)
  failReason  String?
}
```

#### Session
```prisma
model Session {
  id            String   @id @default(cuid())
  sessionToken  String   @unique
  userId        String
  expires       DateTime
  created       DateTime @default(now())
  updated       DateTime @updatedAt
  access_token  String?
  refresh_token String?
  user          User     @relation(...)
}
```

#### SmsLog
```prisma
model SmsLog {
  id         String   @id @default(cuid())
  created    DateTime @default(now())
  updated    DateTime @updatedAt
  message    String
  recipients String[]
  status     String   // 'sent', 'failed', 'partial'
  messageIds String[]
  error      String?
  userId     String
  user       User     @relation(...)
}
```

#### EmailLog
```prisma
model EmailLog {
  id          String   @id @default(cuid())
  created     DateTime @default(now())
  updated     DateTime @updatedAt
  subject     String
  message     String   @db.Text
  recipients  String[]
  status      String   // 'sent', 'failed', 'partial'
  messageId   String?
  error       String?  @db.Text
  attachments Json?    // { files: [{ filename, size }] }
  userId      String
  user        User     @relation(...)
}
```

#### StaffEmailLog (Internal Emails)
```prisma
model StaffEmailLog {
  id          String   @id @default(cuid())
  created     DateTime @default(now())
  updated     DateTime @updatedAt
  subject     String
  message     String
  recipients  String[]
  status      String
  messageId   String?
  error       String?
  attachments Json?
  userId      String
  user        User     @relation(...)
}
```

#### BulletinApiLog
```prisma
model BulletinApiLog {
  id         String     @id @default(cuid())
  title      String
  subject    String
  poster_url String
  category   Categories @default(CHIEFNCOUNCIL)
  userId     String
  User       User       @relation(...)
  created    DateTime   @default(now())
  updated    DateTime   @updatedAt
}
```

#### MsgCnC (Chief & Council Messages)
```prisma
model MsgCnC {
  id          String    @id @default(cuid())
  title       String
  content     String
  priority    String    // 'low', 'medium', 'high'
  type        String    @default("notice") // 'notice', 'event', 'job'
  created     DateTime  @default(now())
  expiryDate  DateTime?
  isPublished Boolean   @default(false)
  userId      String
  User        User      @relation(...)
  date        DateTime
  time        DateTime
  location    String
}
```

#### SignUpForm System
```prisma
model SignUpForm {
  id           String    @id @default(cuid())
  portalFormId String?   @unique  // Synced portal form ID
  title        String
  description  String?   @db.Text
  deadline     DateTime?
  maxEntries   Int?
  isActive     Boolean   @default(true)
  createdBy    String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  syncedAt     DateTime?
  
  fields      FormField[]
  submissions FormSubmission[]
}

model FormField {
  id          String     @id @default(cuid())
  formId      String
  form        SignUpForm @relation(...)
  fieldId     String?    // Semantic ID for auto-fill (e.g., 'full_name', 'email')
  label       String
  fieldType   FieldType
  options     String?    // JSON: ["Option 1", "Option 2"]
  placeholder String?
  required    Boolean    @default(false)
  order       Int
}

model FormSubmission {
  id          String     @id @default(cuid())
  formId      String
  form        SignUpForm @relation(...)
  memberId    Int?
  name        String
  email       String?
  phone       String?
  responses   Json       // { "field_id": "value", ... }
  submittedAt DateTime   @default(now())
}
```

---

## Page Structure & Routing

### Route Map

| Route | Page/Component | Access Level | Purpose |
|-------|---------------|--------------|---------|
| `/` | `page.tsx` | Public | Redirect to login |
| `/login` | `Login.tsx` | Public | User login form |
| `/reset-password` | `PasswordReset.tsx` | Public | Password reset flow |
| `/verify-pin` | `VerifyPIN.tsx` | Public | PIN verification for reset |
| `/auth/error` | Error page | Public | Auth error display |
| `/unauthorized` | Unauthorized | Public | Access denied page |
| `/Staff_Home` | Staff dashboard | STAFF+ | Main staff landing |
| `/Staff_Communications` | Communications.tsx | STAFF+ | SMS, Email, Bulletins |
| `/Staff_Forms` | FormBuilder, FormList | STAFF+ | Sign-up forms |
| `/Admin_Home` | Admin dashboard | ADMIN+ | Admin landing |
| `/Admin_Dashboard` | AppDashboard.tsx | ADMIN+ | Stats & analytics |
| `/Admin_Users` | UserEditor.tsx | ADMIN+ | User management |

### Role-Based Access

```typescript
enum UserRole {
  STAFF         // Basic staff - can send messages
  STAFF_ADMIN   // Can manage department forms
  ADMIN         // Full admin access
  CHIEF_COUNCIL // Special council access
}
```

### Dashboard Navigation Structure

**Staff Dashboard Features:**
1. **Communications** → `/Staff_Communications`
   - SMS Composer
   - Email Composer  
   - Bulletin Creator
2. **Sign-Up Forms** → `/Staff_Forms`
   - Form Builder
   - Form List
   - Submissions Viewer
3. **Event Planner** (Coming Soon)

**Admin Dashboard Features:**
1. Everything staff has, plus:
2. **User Management** → `/Admin_Users`
3. **System Dashboard** → `/Admin_Dashboard`
   - Stats overview
   - Activity logs

---

## External API Integrations

### 1. Twilio (SMS)

**Endpoint**: `POST /api/sms`

**Config:**
```typescript
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER
```

**Request:**
```typescript
{
  message: string,           // SMS content (160 char limit per segment)
  recipients: string[]       // Array of phone numbers
}
```

**Twilio Call:**
```typescript
await client.messages.create({
  body: message,
  from: twilioPhoneNumber,
  to: formattedNumber,  // +1XXXXXXXXXX format
})
```

**Response:**
```typescript
{
  success: boolean,
  message: string,
  results: {
    successful: number,
    failed: number,
    total: number,
    messageIds: string[]
  }
}
```

---

### 2. Resend (Email)

**Endpoint**: `POST /api/email`

**Config:**
```typescript
const resend = new Resend(process.env.RESEND_API_KEY)
const fromEmail = process.env.RESEND_FROM_EMAIL
const fromName = process.env.RESEND_FROM_NAME
```

**Request (FormData):**
```typescript
{
  subject: string,
  message: string,
  recipients: string,    // JSON stringified array
  attachments: File[]    // Optional, max 10MB total
}
```

**Resend Call:**
```typescript
await resend.emails.send({
  from: `${fromName} <${fromEmail}>`,
  to: [email],
  subject: subject,
  html: htmlTemplate,
  text: plainTextVersion,
  attachments: attachmentsArray  // Optional
})
```

**Response:**
```typescript
{
  success: boolean,
  message: string,
  results: {
    successful: number,
    failed: number,
    total: number,
    messageId: string | null
  }
}
```

---

### 3. TCN Portal API (Member Contacts)

**Purpose**: Fetch community member contact info (phones/emails) for messaging.

**Base URL**: `process.env.PORTAL_API_URL` (e.g., `https://tcnaux.ca/api/sync`)

**Authentication**: API Key header `X-API-Key`

**Endpoint Used**: `GET /api/contacts` (local proxy) → Portal's `/contacts`

**Request Params:**
```typescript
{
  query: string,      // Search term (name, community, or address)
  limit: number,      // Max results (default 50)
  offset: number,     // Pagination offset
  activated: 'true',  // Only active members
  fields: 'both'      // Get phone and email
}
```

**Portal Response:**
```typescript
{
  success: boolean,
  data: {
    contacts: PortalContact[],
    count: number,
    pagination: {
      hasMore: boolean,
      nextCursor: string | null,
      limit: number
    }
  }
}

interface PortalContact {
  memberId: string,
  name: string,
  firstName: string,
  lastName: string,
  phone?: string,
  email?: string,
  community?: string,
  address?: string,
  status?: string,
  activated?: string,
  birthdate?: string
}
```

**Member Data Structure (App Internal):**
```typescript
interface Member {
  id: string,
  memberId?: string,
  name?: string,
  personal_info: {
    first_name: string,
    last_name: string,
    date_of_birth?: string
  },
  phone?: string,
  email?: string,
  contact_info?: {
    email?: string,
    phone?: string
  },
  community?: string,
  address?: string,
  status?: string,
  activated?: string,
  birthdate?: string
}
```

**TCN API Client Methods:**
```typescript
class TCNApiClient {
  testConnection(): Promise<boolean>
  searchMembers(searchTerm: string, limit?: number): Promise<APIResponse<Member[]>>
  getMembers(params?): Promise<APIResponse<Member[]>>
  getMemberByTNumber(tNumber: string): Promise<APIResponse<Member | null>>
  getMembersByCommunity(community: string): Promise<APIResponse<Member[]>>
  getAllEmails(limit?: number): Promise<APIResponse<Member[]>>
  getAllPhoneNumbers(limit?: number): Promise<APIResponse<Member[]>>
}
```

---

### 4. Portal Form Sync API

**Purpose**: Sync sign-up forms to the public TCN Portal.

**Base URL**: `process.env.TCN_PORTAL_URL` (e.g., `https://tcnaux.ca`)

**Endpoints:**

**Create Form**: `POST /api/signup-forms`
```typescript
{
  formId: string,
  title: string,
  description: string,
  deadline: string | null,
  maxEntries: number | null,
  isActive: boolean,
  category: string,
  createdBy: string,
  fields: FormField[]
}
```

**Update Form**: `PUT /api/signup-forms/:portalFormId`

**Delete Form**: `DELETE /api/signup-forms/:portalFormId`

**Headers:**
```typescript
{
  'Content-Type': 'application/json',
  'X-API-Key': PORTAL_API_KEY,
  'X-Source': 'tcn-comm'
}
```

---

## Authentication System

### Current (NextAuth.js)

**Strategy**: JWT-based with credentials provider

**Auth Flow:**
1. User submits email/password
2. Server validates credentials against Prisma User
3. JWT token issued with user info
4. Token stored in cookies
5. Session validated on each request

**Auth Options (`lib/auth/auth-options.ts`):**
```typescript
{
  providers: [CredentialsProvider],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60  // 24 hours
  },
  callbacks: {
    jwt: (adds user data to token),
    session: (exposes data to client)
  },
  pages: {
    signIn: '/login',
    error: '/auth/error'
  }
}
```

**Session User Data:**
```typescript
{
  id: string,
  email: string,
  name: string,
  first_name: string,
  last_name: string,
  department: Department,
  role: UserRole
}
```

**Account Lockout:**
- 5 failed attempts = 30 minute lockout
- `loginAttempts` counter on User
- `lockedUntil` timestamp

**Password Hashing:**
```typescript
import bcrypt from 'bcryptjs'

// Hash (10 rounds)
const hashedPassword = await bcrypt.hash(password, 10)

// Verify
const isValid = await bcrypt.compare(password, hashedPassword)
```

### Electron Adaptation

For Electron, simplify authentication:

1. **Store session in electron-store** (encrypted local storage)
2. **No cookies needed** - just keep user in memory/store
3. **Simpler flow:**
   ```typescript
   // Login
   const user = await validateUser(email, password)
   electronStore.set('currentUser', user)
   
   // Check auth
   const user = electronStore.get('currentUser')
   if (!user) redirect('/login')
   
   // Logout
   electronStore.delete('currentUser')
   ```

---

## Component Architecture

### Core Components

| Component | File | Purpose |
|-----------|------|---------|
| `SessionBar` | `SessionBar.tsx` | Top nav with user info, logout |
| `Communications` | `Communications.tsx` | Tab container for SMS/Email/Bulletin |
| `SmsComposer` | `SmsComposer.tsx` | SMS composition form |
| `EmailComposer` | `EmailComposer.tsx` | Email composition with attachments |
| `BulletinCreator` | `BulletinCreator.tsx` | Bulletin/announcement creator |
| `MemberSearch` | `MemberSearch.tsx` | Search & select recipients |
| `FormBuilder` | `FormBuilder.tsx` | Create sign-up forms |
| `FormList` | `FormList.tsx` | List/manage forms |
| `SubmissionsViewer` | `SubmissionsViewer.tsx` | View form submissions |
| `UserEditor` | `UserEditor.tsx` | Admin user management |
| `Login` | `Login.tsx` | Login form |
| `PasswordReset` | `PasswordReset.tsx` | Password reset flow |
| `VerifyPIN` | `VerifyPIN.tsx` | PIN verification |

### UI Components (shadcn/ui)

Located in `components/ui/`:
- `alert.tsx`, `badge.tsx`, `button.tsx`, `card.tsx`
- `checkbox.tsx`, `dialog.tsx`, `dropdown-menu.tsx`
- `input.tsx`, `label.tsx`, `select.tsx`, `separator.tsx`
- `sheet.tsx`, `sonner.tsx` (toasts), `table.tsx`
- `tabs.tsx`, `textarea.tsx`

### Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useMembers` | `useMembers.ts` | Member search with TCNApiClient |

---

## Environment Variables

### Required for App
```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=msgmanager"

# Authentication
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Twilio SMS
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your-auth-token"
TWILIO_PHONE_NUMBER="+1234567890"

# Resend Email
RESEND_API_KEY="re_xxxxxxxxxxxx"
RESEND_FROM_EMAIL="noreply@yourdomain.com"
RESEND_FROM_NAME="TCN Band Office"

# Portal API
PORTAL_API_URL="https://tcnaux.ca/api/sync"
PORTAL_API_KEY="your-portal-api-key"
TCN_PORTAL_URL="https://tcnaux.ca"
TCN_PORTAL_API_KEY="your-portal-api-key"
```

### For Electron
Store sensitive keys securely using:
- `electron-store` with encryption
- OS keychain (via `keytar`)
- Or continue using `.env` file in app directory

---

## Electron-Specific Considerations

### Architecture Options

**Option A: Electron + React (Recommended)**
```
electron-app/
├── main/               # Electron main process
│   ├── main.ts         # App entry, window management
│   ├── preload.ts      # IPC bridge
│   └── services/       # Backend logic (replaces API routes)
│       ├── sms.ts
│       ├── email.ts
│       ├── contacts.ts
│       └── database.ts
├── renderer/           # React frontend
│   ├── components/     # Copy from Next.js
│   ├── pages/          # Convert from app router
│   └── hooks/
├── prisma/
│   └── schema.prisma
└── package.json
```

**Option B: Electron wrapping Next.js**
- Run Next.js in production mode inside Electron
- More overhead but less refactoring

### Key Changes for Electron

1. **Replace API Routes with IPC**
   ```typescript
   // Next.js API route
   export async function POST(request) { ... }
   
   // Electron IPC
   ipcMain.handle('send-sms', async (event, { message, recipients }) => {
     // Same logic
   })
   
   // Renderer call
   const result = await ipcRenderer.invoke('send-sms', { message, recipients })
   ```

2. **Database Options**
   - **SQLite**: Bundled with app, works offline
   - **Remote PostgreSQL**: Requires internet, keeps sync with web app
   - **Hybrid**: SQLite local cache + PostgreSQL sync

3. **File System Access**
   - Native file dialogs for attachments
   - Local file storage for drafts

4. **Notifications**
   - Use Electron's native notification API
   - System tray icon with badge counts

5. **Auto Updates**
   - Use `electron-updater` for auto-updates
   - Publish to GitHub Releases or your server

### Recommended Packages

```json
{
  "dependencies": {
    "electron": "^28.0.0",
    "@prisma/client": "^5.x",
    "twilio": "^4.x",
    "resend": "^2.x",
    "electron-store": "^8.x",
    "bcryptjs": "^2.4.3"
  },
  "devDependencies": {
    "electron-builder": "^24.x",
    "@electron/rebuild": "^3.x"
  }
}
```

### Build/Package Commands

```bash
# Development
npm run electron:dev

# Build for current platform
npm run electron:build

# Build for all platforms
npm run electron:build -- --mac --win --linux
```

---

## Quick Start Checklist for Electron Build

- [ ] Set up Electron + React boilerplate
- [ ] Copy/adapt UI components from `components/`
- [ ] Set up Prisma with SQLite (or PostgreSQL)
- [ ] Implement IPC handlers for:
  - [ ] Authentication (local)
  - [ ] SMS sending (Twilio)
  - [ ] Email sending (Resend)
  - [ ] Contact search (Portal API)
  - [ ] Form management
- [ ] Implement local auth system
- [ ] Set up secure config storage
- [ ] Add auto-update capability
- [ ] Test on target platforms
- [ ] Package and distribute

---

## Questions/Notes

_Add your notes here as you build:_

- 
- 
- 

---

**Last Updated**: January 6, 2026  
**Source App Version**: TCN Communications v1.0
