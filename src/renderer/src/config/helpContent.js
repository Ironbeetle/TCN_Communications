/**
 * Help content registry — keyed by activeView name.
 * HelpDrawer looks up the current view and renders the matching entry.
 */

export const helpContent = {
  // ─── Staff Dashboard ───────────────────────────────
  home: {
    title: 'Staff Dashboard',
    description:
      'Your central hub for quick access to all TCN tools. View unread memos, timesheet deadlines, and draft travel forms at a glance.',
    steps: [
      { label: 'Check your overview', detail: 'The quick stats bar shows urgent items like unread memos and upcoming deadlines.' },
      { label: 'Navigate to a tool', detail: 'Click any card or use the top navigation bar to jump to Communications, Staff Tools, or Forms.' }
    ],
    tips: [
      'Cards with badges indicate items that need your attention.',
      'The welcome section shows your name and a daily summary.'
    ],
    faqs: [
      { question: 'Why don\'t I see any stats?', answer: 'Stats appear when there are pending items (unread memos, draft travel forms, etc.). If everything is up to date, the stats bar may be empty.' },
      { question: 'How do I get back here?', answer: 'Click "Home" in the top navigation bar from any view.' }
    ]
  },

  communications: {
    title: 'Communications Hub',
    description:
      'The communications center lets you send SMS messages, email campaigns, and portal bulletins to TCN community members.',
    steps: [
      { label: 'Choose a channel', detail: 'Select SMS, Email, or Bulletins depending on how you want to reach members.' },
      { label: 'Compose your message', detail: 'Each channel has its own composer with recipient selection and message formatting.' }
    ],
    tips: [
      'SMS is best for urgent, short notices.',
      'Email supports attachments and rich formatting.',
      'Bulletins appear on the member portal for everyone to see.'
    ]
  },

  sms: {
    title: 'SMS Composer',
    description:
      'Send text messages to community members. Select recipients by group or individually, type your message, and send.',
    steps: [
      { label: 'Select recipients', detail: 'Use the member search to pick individuals or select entire groups.' },
      { label: 'Write your message', detail: 'Keep it concise — SMS messages have character limits.' },
      { label: 'Review and send', detail: 'Double-check the recipient list and message before clicking Send.' }
    ],
    tips: [
      'Messages over 160 characters may be split into multiple texts.',
      'You can search members by name, band number, or phone number.'
    ],
    faqs: [
      { question: 'Can I send to all members at once?', answer: 'Yes — use the group selector to choose "All Members" or specific categories.' },
      { question: 'Will members see my personal number?', answer: 'No. Messages are sent from the TCN system number.' }
    ]
  },

  email: {
    title: 'Email Composer',
    description:
      'Send email campaigns with rich formatting and attachments to community members.',
    steps: [
      { label: 'Select recipients', detail: 'Choose individuals or groups from the member directory.' },
      { label: 'Compose your email', detail: 'Add a subject line, write your message, and optionally attach files.' },
      { label: 'Choose a letterhead', detail: 'Select an official letterhead template for professional communications.' },
      { label: 'Send', detail: 'Review everything and click Send to deliver the email.' }
    ],
    tips: [
      'Use letterheads for official communications.',
      'Attachments should be under 10 MB each.',
      'Preview your email before sending to check formatting.'
    ],
    faqs: [
      { question: 'Can I attach multiple files?', answer: 'Yes, you can attach multiple files to a single email.' },
      { question: 'What email address do messages come from?', answer: 'Emails are sent from the official TCN communications email address.' }
    ]
  },

  bulletin: {
    title: 'Bulletin Creator',
    description:
      'Create bulletins that appear on the TCN member portal. Choose between text-based or poster-style bulletins.',
    steps: [
      { label: 'Pick a format', detail: 'Choose Text Bulletin for written announcements or Poster Bulletin for image-based notices.' },
      { label: 'Fill in the details', detail: 'Add a title, content, category, and optional scheduling.' },
      { label: 'Publish', detail: 'Submit the bulletin to make it live on the member portal.' }
    ],
    tips: [
      'Poster bulletins are great for events and visual announcements.',
      'Text bulletins support formatting and are easier to create quickly.',
      'You can schedule bulletins to publish at a future date.'
    ]
  },

  staff: {
    title: 'Staff Tools',
    description:
      'Internal tools for band office staff including office memos, timesheets, and travel request forms.',
    steps: [
      { label: 'Select a tool', detail: 'Click on Office Memos, Timesheets, or Travel Requests to open the tool.' }
    ],
    tips: [
      'Check office memos regularly for important announcements.',
      'Submit timesheets before the bi-weekly deadline.',
      'Save travel forms as drafts if you need to complete them later.'
    ]
  },

  memos: {
    title: 'Office Memos',
    description:
      'View inter-office communications and announcements from staff and management. Memos are sorted by priority and date.',
    steps: [
      { label: 'Read memos', detail: 'Click on a memo to read it. Unread memos are highlighted.' },
      { label: 'Check priority', detail: 'Look for priority badges — high priority memos need prompt attention.' }
    ],
    tips: [
      'Pinned memos (📌) stay at the top of the list.',
      'The badge in the navigation shows your unread count.',
      'Memos are automatically marked as read when you view them.'
    ],
    faqs: [
      { question: 'Can I reply to a memo?', answer: 'Memos are one-way announcements. Contact the author directly if you need to respond.' },
      { question: 'How long do memos stay visible?', answer: 'Memos remain visible until removed by an administrator.' }
    ]
  },

  timesheets: {
    title: 'Timesheets',
    description:
      'Submit and track your bi-weekly timesheets. Enter your hours for each day of the pay period and submit for approval.',
    steps: [
      { label: 'Select the pay period', detail: 'The current pay period is shown by default. You can navigate to previous periods if needed.' },
      { label: 'Enter your hours', detail: 'Fill in your daily start time, end time, and any breaks or overtime.' },
      { label: 'Submit for approval', detail: 'Once complete, submit your timesheet. Your supervisor will review and approve it.' }
    ],
    tips: [
      'Save your timesheet as a draft if you\'re not ready to submit yet.',
      'Double-check your hours before submitting — corrections require supervisor action.',
      'Submit before the deadline to avoid late submissions.'
    ],
    faqs: [
      { question: 'Can I edit a submitted timesheet?', answer: 'Once submitted, your timesheet is locked. Contact your supervisor to request changes.' },
      { question: 'What are the pay periods?', answer: 'Pay periods are bi-weekly. The current period dates are shown at the top of the form.' }
    ]
  },

  travel: {
    title: 'Travel Forms',
    description:
      'Submit travel authorization requests. Fill in your travel details including destination, dates, purpose, and estimated costs.',
    steps: [
      { label: 'Start a new form', detail: 'Click "New Travel Request" to begin a new travel authorization.' },
      { label: 'Fill in travel details', detail: 'Enter your destination, travel dates, purpose, and any estimated expenses.' },
      { label: 'Submit for approval', detail: 'Submit the form for supervisor and finance approval before booking travel.' }
    ],
    tips: [
      'Save as draft if you need to gather information before submitting.',
      'Include all expected expenses for accurate budgeting.',
      'Submit travel requests well in advance of your travel dates.'
    ],
    faqs: [
      { question: 'How far in advance should I submit?', answer: 'Submit at least two weeks before your travel date to allow time for approvals.' },
      { question: 'Can I edit a submitted form?', answer: 'Once submitted, the form is locked for review. Contact your supervisor if changes are needed.' }
    ]
  },

  forms: {
    title: 'Sign-Up Forms',
    description:
      'Create and manage sign-up forms for community events and programs. View submissions and track participation.',
    steps: [
      { label: 'Browse forms', detail: 'View all active sign-up forms and their current submission counts.' },
      { label: 'Create a new form', detail: 'Use the form builder to create custom sign-up forms with fields you need.' },
      { label: 'View submissions', detail: 'Click on a form to see who has signed up and their responses.' }
    ],
    tips: [
      'Forms can be shared on the member portal automatically.',
      'You can export submission data for reporting.',
      'Set a deadline to automatically close form submissions.'
    ]
  },

  // ─── Admin-specific views ─────────────────────────
  users: {
    title: 'User Management',
    description:
      'Manage staff accounts — create new users, edit roles, reset passwords, and control access.',
    steps: [
      { label: 'Find a user', detail: 'Search by name or browse the user list.' },
      { label: 'Edit details', detail: 'Click on a user to update their role, department, or contact information.' },
      { label: 'Manage access', detail: 'Lock or unlock accounts and reset passwords as needed.' }
    ],
    tips: [
      'Assign the correct role to ensure proper access levels.',
      'Locked accounts cannot sign in until unlocked by an admin.'
    ]
  },

  // ─── Department Admin views ────────────────────────
  approvals: {
    title: 'Approvals Dashboard',
    description:
      'Review and approve timesheets and travel forms submitted by staff in your department.',
    steps: [
      { label: 'Review pending items', detail: 'Items awaiting your approval are listed with priority indicators.' },
      { label: 'Approve or return', detail: 'Review each submission and approve it or return it with comments for corrections.' }
    ],
    tips: [
      'Check approvals regularly to avoid delays for your staff.',
      'Add comments when returning items so staff know what to fix.'
    ]
  },

  'review-timesheets': {
    title: 'Timesheet Review',
    description:
      'Review and approve timesheets submitted by staff in your department.',
    steps: [
      { label: 'Select a timesheet', detail: 'Click on a pending timesheet to review the submitted hours.' },
      { label: 'Verify hours', detail: 'Check that the hours match expected schedules and policies.' },
      { label: 'Approve or return', detail: 'Approve the timesheet or return it with notes for correction.' }
    ]
  },

  'review-travel': {
    title: 'Travel Form Review',
    description:
      'Review and approve travel authorization forms submitted by your department staff.',
    steps: [
      { label: 'Select a form', detail: 'Click on a pending travel request to review the details.' },
      { label: 'Review expenses', detail: 'Verify the travel purpose and estimated costs are reasonable.' },
      { label: 'Approve or return', detail: 'Approve the request or return it with feedback.' }
    ]
  },

  'staff-tools': {
    title: 'Staff Tools',
    description:
      'Internal tools for department management including timesheets, travel forms, and office memos.',
    steps: [
      { label: 'Select a tool', detail: 'Choose from timesheets, travel forms, or office memos.' }
    ]
  }
}

/**
 * Look up help content for the given activeView.
 * Returns the HelpEntry or null if none is registered.
 */
export function getHelpForView(activeView) {
  return helpContent[activeView] || null
}
