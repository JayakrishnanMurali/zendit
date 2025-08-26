# Zendit MVP - Product Requirements Document

## Executive Summary

A personal finance management PWA built with Next.js and TypeScript, designed specifically for Indian users. The MVP focuses on transaction import, categorization, and basic spending insights to help users understand and control their financial habits.

## Product Vision

**Mission**: Help Indian users gain complete visibility and control over their personal finances through automated transaction tracking and intelligent insights.

**Target User**: Individual living in India who wants to track personal finances without sharing data with third-party services.

## MVP Scope & Goals

### Primary Goals

- Import and categorize all personal transactions
- Provide spending insights and budget tracking
- Offer a fast, offline-capable PWA experience
- Ensure complete data privacy (local-first approach)

### Success Metrics

- User can import 90% of transactions successfully
- User categorizes transactions with <30 seconds effort per transaction
- User identifies at least 3 actionable spending insights within first week
- App loads in <2 seconds and works offline

## Core Features

### 1. Transaction Import & Management

#### 1.1 PDF Statement Upload

**Priority: P0**

- Upload bank statement PDFs via drag-and-drop interface
- Support major Indian banks (HDFC, ICICI, SBI, Axis, Kotak)
- Real-time parsing progress with Web Worker
- Display parsing errors with clear guidance

**Acceptance Criteria:**

- User can upload multiple PDF files simultaneously
- Parsing progress shows percentage complete
- Successfully parsed transactions appear in review screen
- Duplicate transactions are automatically detected and flagged

#### 1.2 Email Transaction Parsing

**Priority: P1**

- Connect Gmail/Outlook account for transaction email parsing
- Auto-categorize based on email patterns
- Real-time sync of new transaction emails

**Acceptance Criteria:**

- User can authenticate with Gmail OAuth
- System parses transaction amounts, merchants, dates from emails
- New emails are checked every 5 minutes when app is active

#### 1.3 Manual Transaction Entry

**Priority: P0**

- Quick-add transaction form with smart defaults
- Recent merchant/category suggestions
- Bulk edit capabilities

**Acceptance Criteria:**

- Form auto-completes merchant names and categories based on history
- User can add transaction in <15 seconds
- Supports both debit and credit transactions

### 2. Transaction Categorization

#### 2.1 Smart Auto-Categorization

**Priority: P0**

- ML-based categorization using merchant names and descriptions
- Indian merchant database (Swiggy→Food, BigBasket→Groceries, etc.)
- Learning from user corrections

**Acceptance Criteria:**

- 70% of transactions auto-categorized correctly on first attempt
- User corrections improve future categorization accuracy
- Supports 15+ predefined categories relevant to Indian spending

#### 2.2 Category Management

**Priority: P1**

- Custom category creation and editing
- Subcategory support (Food → Restaurants, Groceries)
- Category-based rules and patterns

**Acceptance Criteria:**

- User can create custom categories with icons and colors
- Categories can have subcategories up to 2 levels deep
- Rules can auto-categorize based on amount ranges, merchant names, descriptions

### 3. Spending Insights & Analytics

#### 3.1 Dashboard Overview

**Priority: P0**

- Current month spending summary
- Top spending categories with visual breakdown
- Account balance summary
- Recent transactions list

**Acceptance Criteria:**

- Dashboard loads in <2 seconds
- Shows current month vs previous month comparisons
- Visual pie/bar charts for category breakdown
- Quick access to add new transactions

#### 3.2 Spending Analysis

**Priority: P0**

- Monthly and category-wise spending trends
- Spending pattern identification (weekdays vs weekends)
- Top merchants and unusual spending alerts

**Acceptance Criteria:**

- Charts show 6 months of historical data
- Identifies spending anomalies (>50% higher than average)
- Shows spending velocity (daily average, projected monthly total)

#### 3.3 Budget Tracking

**Priority: P1**

- Set monthly budgets per category
- Real-time budget vs actual spending
- Budget overspend alerts and recommendations

**Acceptance Criteria:**

- User can set and modify budgets easily
- Visual progress bars show budget utilization
- Alerts when approaching 80% and 100% of budget
- Suggests budget adjustments based on historical spending

### 4. Data Management

#### 4.1 Local Data Storage

**Priority: P0**

- Client-side database using IndexedDB
- Data export capabilities (JSON, CSV)
- Secure local storage with encryption

**Acceptance Criteria:**

- All data stored locally on user's device
- No data sent to external servers except for email OAuth
- User can export all data in standard formats
- Data persists across browser sessions and updates

#### 4.2 Data Privacy & Security

**Priority: P0**

- No server-side data storage
- Local data encryption
- Secure authentication flows

**Acceptance Criteria:**

- Financial data never leaves user's device
- OAuth tokens securely managed
- Local data encrypted at rest
- Clear privacy policy explaining local-first approach

## Technical Architecture

### Frontend Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Dexie.js (IndexedDB wrapper)
- **PDF Processing**: PDF.js in Web Workers
- **Charts**: Recharts
- **PWA**: next-pwa plugin

### Key Components

```
src/
├── app/
│   ├── dashboard/          # Main dashboard
│   ├── transactions/       # Transaction management
│   ├── analytics/          # Spending insights
│   └── settings/          # User preferences
├── components/
│   ├── ui/                # Reusable UI components
│   ├── charts/            # Chart components
│   └── forms/             # Form components
├── lib/
│   ├── db/                # Database operations
│   ├── parsers/           # PDF/Email parsers
│   ├── ml/                # Categorization logic
│   └── utils/             # Helper functions
├── workers/
│   └── pdfParser.ts       # PDF processing worker
└── types/
    └── index.ts           # TypeScript definitions
```

### Data Models

#### Core Entities

```typescript
interface Transaction {
  id: string;
  date: Date;
  amount: number;
  description: string;
  type: "debit" | "credit";
  category: string;
  subcategory?: string;
  merchant?: string;
  account: string;
  paymentMethod: string;
  isRecurring: boolean;
  tags: string[];
  notes?: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Account {
  id: string;
  name: string;
  type: "savings" | "current" | "credit_card";
  bank: string;
  balance: number;
  creditLimit?: number;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  budget?: number;
  parent?: string;
}

interface Budget {
  categoryId: string;
  amount: number;
  period: "monthly" | "weekly";
  spent: number;
}
```

## User Experience

### User Journey

1. **Onboarding**: Upload first bank statement
2. **Setup**: Review and categorize initial transactions
3. **Daily Use**: Quick transaction review and categorization
4. **Insights**: Weekly spending review and budget adjustments
5. **Optimization**: Monthly analysis and financial planning

### Key User Flows

#### Transaction Import Flow

1. User drags PDF file to upload area
2. System shows parsing progress with estimated time
3. Parsed transactions appear in review table
4. User reviews auto-categorization and makes corrections
5. Transactions are saved to local database

#### Daily Review Flow

1. User opens app on mobile device
2. Dashboard shows today's transactions and budget status
3. User quickly categorizes any new transactions
4. System provides spending insights and alerts

### PWA Requirements

- **Install Prompt**: Shows after 2 successful uses
- **Offline Mode**: Core functionality works without internet
- **Push Notifications**: Budget alerts and transaction reminders
- **Fast Loading**: <3s initial load, <1s subsequent loads

## Non-Functional Requirements

### Performance

- Initial page load: <3 seconds
- Transaction list rendering: <1 second for 1000 transactions
- PDF parsing: <30 seconds for typical bank statement
- Offline functionality: Core features work without internet

### Security

- Local data encryption using Web Crypto API
- Secure OAuth implementation for email access
- No sensitive data in URLs or logs
- CSP headers and security best practices

### Scalability

- Handle 10,000+ transactions without performance degradation
- Support 50+ bank statement formats
- Efficient data indexing for fast search

### Browser Support

- Modern browsers (Chrome 90+, Firefox 88+, Safari 14+)
- Mobile responsive design
- iOS/Android PWA installation

## Out of Scope (Future Versions)

### Not in MVP

- Multi-user support
- Bank API integrations
- Investment tracking
- Tax planning features
- Bill reminders
- Expense sharing
- Advanced ML/AI features
- Data sync across devices
- Third-party integrations

### Potential V2 Features

- Account Aggregator Framework integration
- Advanced investment portfolio tracking
- Tax optimization suggestions
- Family expense management
- Merchant cashback tracking
- Financial goal planning with timelines

## Success Criteria

### Technical Metrics

- 95% uptime and availability
- <100ms database query response time
- 90% transaction parsing accuracy
- Zero data loss incidents

### User Metrics

- User completes transaction import within 5 minutes
- 80% of users return after first week
- Users categorize 90% of their transactions
- Average session duration >5 minutes

### Business Metrics

- User identifies 3+ actionable spending insights
- 70% improvement in spending awareness (user survey)
- 50% of users set up budgets within first month

## Launch Plan

### Development Phases

**Phase 1 (Weeks 1-2): Core Infrastructure**

- Next.js setup with TypeScript
- Database schema and basic CRUD operations
- PDF parsing with Web Worker
- Basic UI components and routing

**Phase 2 (Weeks 3-4): Transaction Management**

- Statement upload and parsing
- Transaction list and detail views
- Manual transaction entry
- Basic categorization

**Phase 3 (Weeks 5-6): Insights & Analytics**

- Dashboard with spending summaries
- Category-wise breakdown charts
- Spending trends and patterns
- Budget tracking basics

**Phase 4 (Week 7): PWA & Polish**

- PWA configuration and offline support
- Performance optimization
- UI/UX polish and responsive design
- Error handling and edge cases

**Phase 5 (Week 8): Testing & Launch**

- Comprehensive testing across browsers
- Performance and security audits
- Documentation and user guides
- Beta testing with friends/family

### Risk Mitigation

**Technical Risks:**

- PDF parsing accuracy → Build robust parser with fallback options
- Performance with large datasets → Implement pagination and virtualization
- Browser compatibility → Progressive enhancement approach

**User Adoption Risks:**

- Complex onboarding → Streamlined setup with sample data
- Data privacy concerns → Clear communication about local-first approach
- Feature overwhelm → Gradual feature rollout based on usage

## Conclusion

This MVP focuses on solving the core problem of transaction visibility and categorization while maintaining simplicity and privacy. The local-first approach differentiates it from cloud-based alternatives while ensuring user data remains completely private.

The phased development approach allows for iterative improvements based on real usage patterns, while the technical architecture provides a solid foundation for future enhancements.
