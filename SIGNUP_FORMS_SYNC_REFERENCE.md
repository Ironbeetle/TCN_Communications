# Sign-Up Forms Sync Reference

This document provides schema and category information for the TCN Communications desktop app's sign-up forms feature. Use this when troubleshooting sync issues with the TCN Portal VPS.

---

## Overview

The TCN Communications desktop app creates sign-up forms locally and syncs them to the TCN Portal VPS via API. A **category selector** was added to the form builder, allowing staff to categorize forms by department.

---

## Database Schema (Prisma)

### SignUpForm Model

```prisma
model SignUpForm {
  id              String    @id @default(cuid())
  portalFormId    String?   @unique   // Synced portal form ID (assigned by VPS)
  title           String
  description     String?
  category        String    @default("RECREATION")  // Department category
  deadline        DateTime?
  maxEntries      Int?
  isActive        Boolean   @default(true)
  allowResubmit   Boolean   @default(false)
  resubmitMessage String?
  createdBy       String
  creator         User      @relation(fields: [createdBy], references: [id], onDelete: Cascade)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  syncedAt        DateTime?

  fields      FormField[]
  submissions FormSubmission[]
}
```

### FormField Model

```prisma
model FormField {
  id          String     @id @default(cuid())
  formId      String
  form        SignUpForm @relation(fields: [formId], references: [id], onDelete: Cascade)
  fieldId     String?    // Semantic ID for auto-fill (e.g., 'full_name', 'email')
  label       String
  fieldType   String     // TEXT, TEXTAREA, SELECT, MULTISELECT, CHECKBOX, DATE, NUMBER, EMAIL, PHONE
  options     String?    // JSON array: ["Option 1", "Option 2"]
  placeholder String?
  required    Boolean    @default(false)
  order       Int
}
```

### FormSubmission Model

```prisma
model FormSubmission {
  id          String     @id @default(cuid())
  formId      String
  form        SignUpForm @relation(fields: [formId], references: [id], onDelete: Cascade)
  memberId    String?
  name        String
  email       String?
  phone       String?
  responses   String     // JSON object: { "field_id": "value", ... }
  submittedAt DateTime   @default(now())
}
```

---

## Category System

### ⚠️ IMPORTANT: Category Values

The desktop app uses **string-based categories** (not an enum) that align with the User department values. The portal VPS must accept these exact values:

| Category Value       | Display Label        | Description                    |
|---------------------|----------------------|--------------------------------|
| `BAND_OFFICE`       | Band Office          | General band office forms      |
| `J_W_HEALTH_CENTER` | J.W. Health Center   | Health center programs         |
| `CSCMEC`            | CSCMEC               | Education center programs      |
| `COUNCIL`           | Council              | Chief & Council forms          |
| `RECREATION`        | Recreation           | Recreation & sports programs   |
| `UTILITIES`         | Utilities            | Utilities department           |
| `TRSC`              | Land Use Programs    | Land use / TRSC programs       |

### Category Selector in Form Builder

The form builder (`src/renderer/src/components/FormBuilder.jsx`) includes a category dropdown:

```jsx
const CATEGORY_OPTIONS = [
  { value: 'BAND_OFFICE', label: 'Band Office' },
  { value: 'J_W_HEALTH_CENTER', label: 'J.W. Health Center' },
  { value: 'CSCMEC', label: 'CSCMEC' },
  { value: 'COUNCIL', label: 'Council' },
  { value: 'RECREATION', label: 'Recreation' },
  { value: 'UTILITIES', label: 'Utilities' },
  { value: 'TRSC', label: 'Land_Use_Programs' }
]
```

- Default category is the user's department
- Staff can override the category when creating/editing forms

---

## API Sync Payload

When syncing to the portal, the desktop app sends this payload structure:

```typescript
POST /api/signup-forms
PUT /api/signup-forms/:portalFormId

{
  formId: string,           // Local form ID (cuid)
  title: string,
  description: string | null,
  deadline: string | null,  // ISO 8601 datetime string
  maxEntries: number | null,
  isActive: boolean,
  category: string,         // One of the category values above
  allowResubmit: boolean,
  resubmitMessage: string | null,
  createdBy: string,        // User ID who created the form
  fields: [
    {
      fieldId: string | null,  // Semantic ID for auto-fill
      label: string,
      fieldType: string,       // TEXT, TEXTAREA, SELECT, etc.
      options: string[] | null,
      placeholder: string | null,
      required: boolean,
      order: number
    }
  ]
}
```

### Headers

```
Content-Type: application/json
x-api-key: <PORTAL_API_KEY>
x-source: tcn-comm
```

---

## Known Sync Issue: Category Enum Mismatch

### Problem

The desktop app currently **strips the category field** before sending to avoid enum validation errors on the portal:

```javascript
// In forms.js syncFormToPortal()
if (payload.category) {
  console.log('Removing category from payload before sending to portal to avoid enum validation')
  delete payload.category
}
```

This workaround was added because the portal's `FormCategory` enum doesn't match the desktop app's category values.

### Solution Required on Portal VPS

The portal should either:

1. **Update its enum** to match the desktop app's category values:
   ```prisma
   enum FormCategory {
     BAND_OFFICE
     J_W_HEALTH_CENTER
     CSCMEC
     COUNCIL
     RECREATION
     UTILITIES
     TRSC
   }
   ```

2. **Or use a string field** instead of an enum (more flexible):
   ```prisma
   model SignUpForm {
     category String @default("RECREATION")
   }
   ```

3. **Or implement category mapping** on the API to translate desktop values to portal values.

---

## Field Types

Both desktop and portal should support these field types:

| Value         | Description                          |
|---------------|--------------------------------------|
| `TEXT`        | Single-line text input               |
| `TEXTAREA`    | Multi-line text input                |
| `EMAIL`       | Email input with validation          |
| `PHONE`       | Phone number input                   |
| `NUMBER`      | Numeric input                        |
| `DATE`        | Date picker                          |
| `SELECT`      | Single-choice dropdown               |
| `MULTISELECT` | Multiple-choice selection            |
| `CHECKBOX`    | Boolean checkbox                     |

---

## Troubleshooting Checklist

1. **Check portal FormCategory enum** - Must include all values listed above
2. **Verify API accepts category field** - Currently being stripped as workaround
3. **Check API key validity** - Must match on both sides
4. **Review portal logs** - Look for validation errors on incoming requests
5. **Test with curl**:
   ```bash
   curl -X POST https://tcnaux.ca/api/signup-forms \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY" \
     -H "x-source: tcn-comm" \
     -d '{"formId":"test","title":"Test Form","category":"RECREATION","fields":[]}'
   ```

---

## Contact

For questions about the desktop app schema, check:
- `prisma/schema.prisma` - Full database schema
- `src/main/services/forms.js` - Form sync logic
- `src/renderer/src/components/FormBuilder.jsx` - Category UI

Last updated: February 2026
