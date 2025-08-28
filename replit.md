# Overview

This is a React-based CRM (Customer Relationship Management) dashboard application for managing sales opportunities through a structured pipeline. The application allows users to track leads from initial contact through various sales phases including prospecting, technical visits, proposals, negotiations, and final outcomes (won/lost). The system features real-time reports and analytics that automatically sync with the main dashboard, providing live insights into sales performance. Built with a modern full-stack architecture featuring a React frontend with shadcn/ui components and an Express.js backend with PostgreSQL database support.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state
- **Form Handling**: React Hook Form with Zod validation
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite for development and bundling

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database queries
- **API Design**: RESTful API with CRUD operations for opportunities and automations
- **Error Handling**: Centralized error middleware with structured JSON responses
- **Development**: Hot module replacement via Vite middleware in development

## Data Storage
- **Database**: PostgreSQL with connection via Neon serverless driver
- **Schema Management**: Drizzle Kit for migrations and schema synchronization
- **Validation**: Zod schemas shared between frontend and backend
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple
- **Fallback Storage**: In-memory storage implementation for development/testing

## Database Schema Design
The opportunities table supports a multi-phase sales pipeline:
- **Phase 1 (Nova Oportunidade)**: Basic contact information, company details
- **Phase 2 (Prospecção)**: Opportunity tracking, salesperson assignment, visit requirements
- **Phase 4 (Visita Técnica)**: Technical visit scheduling and documentation
- **Phase 5 (Proposta)**: Proposal details, pricing, discounts, budgets
- **Phase 6 (Negociação)**: Final negotiations, contracts, win/loss tracking
- **Automations**: Phase-based workflow automations

## Authentication & Session Management
- Session-based authentication using express-session
- PostgreSQL session store for persistence
- CSRF protection and secure cookie configuration
- Middleware-based route protection

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Database URL**: Environment-based configuration for multiple environments

## UI Component Libraries
- **Radix UI**: Headless component primitives for accessibility
- **Lucide React**: Icon library for consistent iconography
- **Font Awesome**: Additional icons via CDN
- **Google Fonts**: Typography (Architects Daughter, DM Sans, Fira Code, Geist Mono)

## Development Tools
- **Replit Integration**: Vite plugins for Replit-specific development features
- **TypeScript**: Full type safety across frontend and backend
- **ESBuild**: Production bundling for server code
- **PostCSS**: CSS processing with Tailwind and Autoprefixer

## Data Processing Libraries
- **date-fns**: Date manipulation and formatting with Portuguese locale
- **class-variance-authority**: Type-safe CSS class composition
- **clsx**: Conditional className utilities
- **zod-validation-error**: Enhanced error messages for Zod validation

## Session & Storage
- **connect-pg-simple**: PostgreSQL session store adapter
- **express-session**: Session middleware for user authentication
- **nanoid**: Unique ID generation for various entities