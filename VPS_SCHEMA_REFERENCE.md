# VPS API Schema Reference - TCN Communications Expansion

This document outlines the Prisma schema additions required on the VPS (API server) to support the new functionality for the TCN Communications desktop app: **Timesheets**, **Travel Request Forms**, and **Inter-Office Memos**.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    VPS (API Server)                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              PostgreSQL Database                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │  fnmemberlist│  │  bandoffice  │  │   (future)   │  │   │
│  │  │   schema     │  │   schema     │  │   schemas    │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                     Express/Fastify API                          │
└─────────────────────────────│────────────────────────────────────┘
                              │ HTTPS
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼───────┐    ┌───────▼───────┐    ┌───────▼───────┐
│  Building A   │    │  Building B   │    │  Building C   │
│  TCN Comms    │    │  TCN Comms    │    │  TCN Comms    │
│  Desktop App  │    │  Desktop App  │    │  Desktop App  │
└───────────────┘    └───────────────┘    └───────────────┘
```

---

## Schema Additions

Add the following to your VPS Prisma schema file. All new models should be under the `bandoffice` schema.

### 1. Enumerations

```prisma
// Add these enums to the bandoffice schema

enum MemoPriority {
  low
  medium
  high
  @@schema("bandoffice")
}

enum TimeSheetStatus {
  DRAFT
  SUBMITTED
  APPROVED
  REJECTED
  @@schema("bandoffice")
}

enum TransportationType {
  PERSONAL_VEHICLE
  PUBLIC_TRANSPORT_WINNIPEG
  PUBLIC_TRANSPORT_THOMPSON
  COMBINATION
  OTHER
  @@schema("bandoffice")
}

enum TravelFormStatus {
  DRAFT
  SUBMITTED
  UNDER_REVIEW
  APPROVED
  REJECTED
  ISSUED
  COMPLETED
  CANCELLED
  @@schema("bandoffice")
}
```

---

### 2. User Model Updates

Add these relations to your existing `User` model:

```prisma
model User {
  // ... existing fields ...
  
  // Add these new relations
  office_memos       OfficeMemo[]
  timesheets         TimeSheet[]
  travel_forms       Travel_Forms[]
  
  @@schema("bandoffice")
}
```

---

### 3. Inter-Office Memo System

```prisma
// ===========================================
// INTER-OFFICE MEMO SYSTEM
// ===========================================
// Purpose: Internal communications between staff across different
// buildings/departments. Supports priority levels, pinning,
// department-specific targeting, and read tracking.

model OfficeMemo {
  id          String        @id @default(cuid())
  title       String
  content     String        @db.Text
  priority    MemoPriority  @default(low)     // low, medium, high
  department  String?                          // Target specific department, null = all
  isPinned    Boolean       @default(false)   // Pin to top of memo list
  isPublished Boolean       @default(false)   // Draft vs Published
  expiryDate  DateTime?                        // Optional auto-expire
  readBy      String[]      @default([])      // Array of user IDs who have read
  
  // Timestamps
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  
  // Author relation
  authorId    String
  author      User          @relation(fields: [authorId], references: [id], onDelete: Cascade)
  
  @@index([department])
  @@index([priority])
  @@index([createdAt])
  @@schema("bandoffice")
}
```

**Key Features:**
- **Priority Levels**: Memos can be marked as low, medium, or high priority
- **Department Targeting**: Send memos to specific departments or all staff
- **Pinning**: Important memos can be pinned to the top
- **Read Tracking**: Track which users have read each memo
- **Auto-Expiry**: Optionally set memos to expire after a certain date

---

### 4. Timesheet Management System

```prisma
// ===========================================
// TIMESHEET MANAGEMENT SYSTEM
// ===========================================
// Purpose: Bi-weekly timesheet submission for staff payroll.
// Two-week pay periods starting on Mondays.

model TimeSheet {
  id              String            @id @default(cuid())
  
  // Timestamps
  created         DateTime          @default(now())
  updated         DateTime          @default(now()) @updatedAt
  
  // User relation
  userId          String
  user            User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Pay period information (14-day cycle)
  payPeriodStart  DateTime          @db.Date
  payPeriodEnd    DateTime          @db.Date
  
  // Status workflow
  status          TimeSheetStatus   @default(DRAFT)
  submittedAt     DateTime?
  approvedAt      DateTime?
  approvedBy      String?           // ID of approving admin
  rejectedAt      DateTime?
  rejectedBy      String?           // ID of rejecting admin
  rejectionReason String?           @db.Text
  
  // Weekly and total hours (calculated from entries)
  week1Total      Decimal           @db.Decimal(5,2) @default(0)
  week2Total      Decimal           @db.Decimal(5,2) @default(0)
  grandTotal      Decimal           @db.Decimal(5,2) @default(0)
  
  // Time entries relation
  timeEntries     TimeEntry[]
  
  // Unique constraint: one timesheet per user per pay period
  @@unique([userId, payPeriodStart])
  @@index([status])
  @@index([payPeriodStart])
  @@schema("bandoffice")
}

model TimeEntry {
  id           String     @id @default(cuid())
  
  // Timestamps
  created      DateTime   @default(now())
  updated      DateTime   @default(now()) @updatedAt
  
  // Parent timesheet
  timeSheetId  String
  timeSheet    TimeSheet  @relation(fields: [timeSheetId], references: [id], onDelete: Cascade)
  
  // Daily entry data
  date         DateTime   @db.Date
  startTime    String?                         // Format: "HH:MM" (24hr)
  endTime      String?                         // Format: "HH:MM" (24hr)
  breakMinutes Int        @default(0)          // Break time in minutes
  totalHours   Decimal    @db.Decimal(4,2) @default(0)  // Calculated
  
  @@index([timeSheetId])
  @@index([date])
  @@schema("bandoffice")
}
```

**Key Features:**
- **Bi-Weekly Pay Periods**: 14-day cycles starting on Mondays
- **Daily Time Entries**: Start time, end time, break duration
- **Automatic Calculations**: Weekly and total hours calculated from entries
- **Approval Workflow**: Draft → Submitted → Approved/Rejected
- **Rejection Tracking**: Reason and timestamp for rejections
- **Unique Constraint**: Prevents duplicate timesheets for same pay period

---

### 5. Travel Request Form System

```prisma
// ===========================================
// TRAVEL REQUEST FORM SYSTEM
// ===========================================
// Purpose: Travel authorization and expense estimation for staff.
// Includes accommodation, meals, transportation calculations.

model Travel_Forms {
  id                    String              @id @default(cuid())
  
  // Basic Information
  name                  String                              // Staff name
  destination           String
  departureDate         DateTime
  returnDate            DateTime
  reasonsForTravel      String              @db.Text
  
  // ===== ACCOMMODATION =====
  hotelRate             Decimal             @db.Decimal(10,2) @default(200.00)
  hotelNights           Int                 @default(0)
  hotelTotal            Decimal             @db.Decimal(10,2) @default(0)
  privateRate           Decimal             @db.Decimal(10,2) @default(50.00)   // Private accommodation
  privateNights         Int                 @default(0)
  privateTotal          Decimal             @db.Decimal(10,2) @default(0)
  
  // ===== MEALS (Treasury Board Rates) =====
  breakfastRate         Decimal             @db.Decimal(10,2) @default(20.50)
  breakfastDays         Int                 @default(0)
  breakfastTotal        Decimal             @db.Decimal(10,2) @default(0)
  lunchRate             Decimal             @db.Decimal(10,2) @default(20.10)
  lunchDays             Int                 @default(0)
  lunchTotal            Decimal             @db.Decimal(10,2) @default(0)
  dinnerRate            Decimal             @db.Decimal(10,2) @default(50.65)
  dinnerDays            Int                 @default(0)
  dinnerTotal           Decimal             @db.Decimal(10,2) @default(0)
  
  // ===== INCIDENTALS =====
  incidentalRate        Decimal             @db.Decimal(10,2) @default(10.00)
  incidentalDays        Int                 @default(0)
  incidentalTotal       Decimal             @db.Decimal(10,2) @default(0)
  
  // ===== TRANSPORTATION =====
  transportationType    TransportationType  @default(PERSONAL_VEHICLE)
  
  // Personal Vehicle
  personalVehicleRate   Decimal             @db.Decimal(10,2) @default(0.50)   // Per km rate
  licensePlateNumber    String?
  oneWayWinnipegKm      Int                 @default(904)     // Default TCN to Winnipeg
  oneWayWinnipegTrips   Int                 @default(0)
  oneWayWinnipegTotal   Decimal             @db.Decimal(10,2) @default(0)
  oneWayThompsonKm      Int                 @default(150)     // Default TCN to Thompson
  oneWayThompsonTrips   Int                 @default(0)
  oneWayThompsonTotal   Decimal             @db.Decimal(10,2) @default(0)
  
  // Public Transportation
  winnipegFlatRate      Decimal             @db.Decimal(10,2) @default(450.00)
  thompsonFlatRate      Decimal             @db.Decimal(10,2) @default(100.00)
  publicTransportTotal  Decimal             @db.Decimal(10,2) @default(0)
  
  // Taxi
  taxiFareRate          Decimal             @db.Decimal(10,2) @default(17.30)
  taxiFareDays          Int                 @default(0)
  taxiFareTotal         Decimal             @db.Decimal(10,2) @default(0)
  
  // Parking
  parkingTotal          Decimal             @db.Decimal(10,2) @default(0)
  parkingReceipts       Boolean             @default(false)
  
  // ===== TOTALS =====
  grandTotal            Decimal             @db.Decimal(10,2) @default(0)
  
  // ===== STATUS WORKFLOW =====
  status                TravelFormStatus    @default(DRAFT)
  
  // Submission
  submittedBy           String                              // User ID
  submittedDate         DateTime?
  
  // Authorization
  authorizedBy          String?                             // Admin user ID
  authorizedDate        DateTime?
  rejectedAt            DateTime?
  rejectionReason       String?             @db.Text
  
  // Issuance (when cheque is issued)
  dateIssued            DateTime?
  issuedBy              String?
  chequeNumber          String?
  
  // Notes
  notes                 String?             @db.Text
  
  // Audit Fields
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt
  createdBy             String
  updatedBy             String
  
  // User relation
  userId                String
  submitter             User                @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("travel_forms")
  @@index([status])
  @@index([userId])
  @@index([departureDate])
  @@schema("bandoffice")
}
```

**Key Features:**
- **Comprehensive Expense Tracking**: Accommodation, meals, transportation
- **Treasury Board Rates**: Default rates for meals that can be adjusted
- **Multiple Transportation Options**: Personal vehicle, public transport, or combination
- **Mileage Calculations**: Pre-set distances to common destinations (Winnipeg, Thompson)
- **Extended Workflow**: Draft → Submitted → Under Review → Approved/Rejected → Issued → Completed
- **Cheque Tracking**: Track when travel advance is issued

---

## API Endpoints Required

### Office Memos
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/memos` | Get all published memos (with optional department filter) |
| GET | `/api/memos/:id` | Get specific memo |
| POST | `/api/memos` | Create new memo |
| PUT | `/api/memos/:id` | Update memo |
| DELETE | `/api/memos/:id` | Delete memo |
| POST | `/api/memos/:id/read` | Mark memo as read by user |

### Timesheets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/timesheets/user/:userId` | Get user's timesheets |
| GET | `/api/timesheets/current/:userId` | Get current pay period timesheet |
| GET | `/api/timesheets` | Get all timesheets (admin) |
| GET | `/api/timesheets/:id` | Get specific timesheet |
| POST | `/api/timesheets` | Create new timesheet |
| PUT | `/api/timesheets/:id` | Update timesheet |
| POST | `/api/timesheets/:id/submit` | Submit for approval |
| POST | `/api/timesheets/:id/approve` | Approve timesheet (admin) |
| POST | `/api/timesheets/:id/reject` | Reject timesheet (admin) |
| DELETE | `/api/timesheets/:id` | Delete draft timesheet |

### Travel Forms
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/travel-forms/user/:userId` | Get user's travel forms |
| GET | `/api/travel-forms` | Get all travel forms (admin) |
| GET | `/api/travel-forms/pending` | Get pending approval forms (admin) |
| GET | `/api/travel-forms/:id` | Get specific form |
| POST | `/api/travel-forms` | Create new form |
| PUT | `/api/travel-forms/:id` | Update form |
| POST | `/api/travel-forms/:id/submit` | Submit for approval |
| POST | `/api/travel-forms/:id/approve` | Approve form (admin) |
| POST | `/api/travel-forms/:id/reject` | Reject form (admin) |
| POST | `/api/travel-forms/:id/issue` | Mark as issued (admin) |
| DELETE | `/api/travel-forms/:id` | Delete draft form |

---

## Validation Schemas (Zod)

```typescript
// lib/validation.ts

import { z } from "zod";

// ===== MEMO SCHEMAS =====
export const CreateOfficeMemoSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().min(1, "Content is required"),
  priority: z.enum(["low", "medium", "high"]).default("low"),
  department: z.string().optional().nullable(),
  isPinned: z.boolean().default(false),
  expiryDate: z.string().datetime().optional().nullable(),
  authorId: z.string().cuid("Invalid author ID"),
});

export const UpdateOfficeMemoSchema = CreateOfficeMemoSchema.partial().extend({
  id: z.string().cuid("Invalid memo ID"),
  isPublished: z.boolean().optional(),
});

// ===== TIMESHEET SCHEMAS =====
export const TimeEntrySchema = z.object({
  date: z.string(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  breakMinutes: z.number().int().min(0).default(0),
  totalHours: z.number().min(0).default(0),
});

export const CreateTimeSheetSchema = z.object({
  userId: z.string().cuid("Invalid user ID"),
  payPeriodStart: z.string(),
  payPeriodEnd: z.string(),
  timeEntries: z.array(TimeEntrySchema),
  week1Total: z.number().min(0).default(0),
  week2Total: z.number().min(0).default(0),
  grandTotal: z.number().min(0).default(0),
});

export const UpdateTimeSheetSchema = CreateTimeSheetSchema.partial().extend({
  id: z.string().cuid("Invalid timesheet ID"),
});

export const TimeSheetStatusSchema = z.enum([
  "DRAFT", "SUBMITTED", "APPROVED", "REJECTED"
]);

// ===== TRAVEL FORM SCHEMAS =====
export const TransportationTypeSchema = z.enum([
  "PERSONAL_VEHICLE",
  "PUBLIC_TRANSPORT_WINNIPEG",
  "PUBLIC_TRANSPORT_THOMPSON",
  "COMBINATION",
  "OTHER"
]);

export const TravelFormStatusSchema = z.enum([
  "DRAFT", "SUBMITTED", "UNDER_REVIEW", 
  "APPROVED", "REJECTED", "ISSUED", 
  "COMPLETED", "CANCELLED"
]);

export const CreateTravelFormInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  destination: z.string().min(1, "Destination is required"),
  departureDate: z.string(),
  returnDate: z.string(),
  reasonsForTravel: z.string().min(1, "Reason is required"),
  
  // Accommodation
  hotelRate: z.number().min(0).default(200),
  hotelNights: z.number().int().min(0).default(0),
  hotelTotal: z.number().min(0).default(0),
  privateRate: z.number().min(0).default(50),
  privateNights: z.number().int().min(0).default(0),
  privateTotal: z.number().min(0).default(0),
  
  // Meals
  breakfastRate: z.number().min(0).default(20.50),
  breakfastDays: z.number().int().min(0).default(0),
  breakfastTotal: z.number().min(0).default(0),
  lunchRate: z.number().min(0).default(20.10),
  lunchDays: z.number().int().min(0).default(0),
  lunchTotal: z.number().min(0).default(0),
  dinnerRate: z.number().min(0).default(50.65),
  dinnerDays: z.number().int().min(0).default(0),
  dinnerTotal: z.number().min(0).default(0),
  
  // Incidentals
  incidentalRate: z.number().min(0).default(10),
  incidentalDays: z.number().int().min(0).default(0),
  incidentalTotal: z.number().min(0).default(0),
  
  // Transportation
  transportationType: TransportationTypeSchema.default("PERSONAL_VEHICLE"),
  personalVehicleRate: z.number().min(0).default(0.50),
  licensePlateNumber: z.string().optional().default(""),
  oneWayWinnipegKm: z.number().int().min(0).default(904),
  oneWayWinnipegTrips: z.number().int().min(0).default(0),
  oneWayWinnipegTotal: z.number().min(0).default(0),
  oneWayThompsonKm: z.number().int().min(0).default(150),
  oneWayThompsonTrips: z.number().int().min(0).default(0),
  oneWayThompsonTotal: z.number().min(0).default(0),
  winnipegFlatRate: z.number().min(0).default(450),
  thompsonFlatRate: z.number().min(0).default(100),
  publicTransportTotal: z.number().min(0).default(0),
  taxiFareRate: z.number().min(0).default(17.30),
  taxiFareDays: z.number().int().min(0).default(0),
  taxiFareTotal: z.number().min(0).default(0),
  parkingTotal: z.number().min(0).default(0),
  parkingReceipts: z.boolean().default(false),
  
  // Totals
  grandTotal: z.number().min(0).default(0),
  
  // Status
  status: TravelFormStatusSchema.default("DRAFT"),
  submittedBy: z.string(),
  userId: z.string().cuid(),
  createdBy: z.string(),
});

export const UpdateTravelFormInputSchema = CreateTravelFormInputSchema.partial().extend({
  id: z.string().cuid("Invalid form ID"),
});

// Type exports
export type CreateOfficeMemoInput = z.infer<typeof CreateOfficeMemoSchema>;
export type UpdateOfficeMemoInput = z.infer<typeof UpdateOfficeMemoSchema>;
export type CreateTimeSheetInput = z.infer<typeof CreateTimeSheetSchema>;
export type UpdateTimeSheetInput = z.infer<typeof UpdateTimeSheetSchema>;
export type CreateTravelFormInput = z.infer<typeof CreateTravelFormInputSchema>;
export type UpdateTravelFormInput = z.infer<typeof UpdateTravelFormInputSchema>;
```

---

## Migration Notes

### Running Migrations

After adding the schema changes:

```bash
# Generate migration
npx prisma migrate dev --name add_staff_features

# If using multiple schemas, ensure your PostgreSQL user has access
# to both 'fnmemberlist' and 'bandoffice' schemas

# Generate Prisma Client
npx prisma generate
```

### Data Seeding (Optional)

```typescript
// prisma/seed.ts additions

// Sample office memo
await prisma.officeMemo.create({
  data: {
    title: "Welcome to the New System",
    content: "The new TCN Communications system is now live...",
    priority: "high",
    isPinned: true,
    isPublished: true,
    authorId: adminUserId,
  }
});
```

---

## Desktop App Integration (Electron IPC)

The desktop app communicates with these APIs through Electron's IPC system. Add these handlers to your preload and main process:

### Preload (preload/index.js)
```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing handlers ...
  
  // Memos
  memos: {
    getAll: () => ipcRenderer.invoke('memos:getAll'),
    markAsRead: (memoId, userId) => ipcRenderer.invoke('memos:markAsRead', memoId, userId),
  },
  
  // Timesheets
  timesheets: {
    getStats: (userId) => ipcRenderer.invoke('timesheets:getStats', userId),
    getUserTimesheets: (userId) => ipcRenderer.invoke('timesheets:getUserTimesheets', userId),
    getCurrentPeriod: (userId) => ipcRenderer.invoke('timesheets:getCurrentPeriod', userId),
    create: (data) => ipcRenderer.invoke('timesheets:create', data),
    update: (data) => ipcRenderer.invoke('timesheets:update', data),
    submit: (id) => ipcRenderer.invoke('timesheets:submit', id),
  },
  
  // Travel Forms
  travelForms: {
    getStats: (userId) => ipcRenderer.invoke('travelForms:getStats', userId),
    getUserForms: (userId) => ipcRenderer.invoke('travelForms:getUserForms', userId),
    create: (data) => ipcRenderer.invoke('travelForms:create', data),
    update: (data) => ipcRenderer.invoke('travelForms:update', data),
    submit: (id) => ipcRenderer.invoke('travelForms:submit', id),
  },
});
```

---

## Security Considerations

1. **Authentication**: All API endpoints should require valid JWT tokens
2. **Authorization**: Implement role-based access:
   - `STAFF`: Can only view/edit their own timesheets and travel forms
   - `STAFF_ADMIN`: Can approve timesheets and travel forms
   - `ADMIN/CHIEF_COUNCIL`: Full access including memo management
3. **Input Validation**: Use Zod schemas on both client and server
4. **Rate Limiting**: Implement on the VPS API to prevent abuse

---

## Future Enhancements

1. **Memo Attachments**: Allow file attachments to memos
2. **Timesheet Templates**: Save recurring schedules
3. **Travel Form Reports**: Generate expense reports
4. **Push Notifications**: Real-time memo notifications
5. **Offline Support**: Queue submissions when offline

---

*Last Updated: February 2026*
*Version: 1.0.0*
