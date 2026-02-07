# PNF OEE System - User Manual & Admin Manual

**Version:** 1.0  
**Date:** February 2026  
**System Name:** PNF OEE System  
**Developer:** Arnon Arpaket  

---

## Table of Contents

- PART 1: System Overview
- PART 2: User Roles and Permissions
- PART 3: User Manual (End User)
- PART 4: Admin Manual
- PART 5: Data and System Behavior
- PART 6: Common Issues and Troubleshooting
- PART 7: Best Practices and Operation Guidelines

---

# PART 1: SYSTEM OVERVIEW

## 1.1 Purpose of the System

PNF OEE System is a web-based manufacturing performance management application designed to monitor and improve Overall Equipment Effectiveness (OEE) across production facilities. The system enables real-time tracking of three core manufacturing metrics:

- **Availability (A):** The proportion of scheduled time that equipment is actually available for production.
- **Performance (P):** The speed at which equipment operates compared to its ideal cycle time.
- **Quality (Q):** The proportion of products that meet quality standards versus total products produced.

OEE is calculated as: **OEE = Availability x Performance x Quality**

The system provides a complete workflow from shopfloor data capture through supervisory review to executive-level performance dashboards.

## 1.2 Problems This System Solves (Pain Points)

1. **Manual data collection on paper** - Production events (run, downtime, setup) and counts (good/reject quantities) were previously tracked on paper, leading to data loss, inaccuracy, and delays. This system digitizes the entire capture process.

2. **No real-time visibility** - Without a centralized system, managers and executives could not see current production status. This system provides real-time dashboards with auto-refresh capabilities.

3. **Inaccurate OEE calculations** - Manual OEE calculations are error-prone. The system automates OEE computation based on recorded events and counts.

4. **No audit trail** - Paper records are easy to alter. The system maintains a complete audit trail of every data change, ensuring accountability.

5. **Lack of standardized workflows** - The shift approval and locking workflow ensures data integrity. Once a shift is locked, data cannot be modified retroactively.

6. **Difficult loss analysis** - The system provides Pareto charts, loss categorization, and trend analysis to identify the biggest sources of production losses.

7. **Multi-company management difficulty** - For organizations managing multiple companies or factories, the system provides centralized multi-tenant management with proper data isolation.

## 1.3 Who Should Use This System

| User Type | Description |
|-----------|-------------|
| **Operators / Staff** | Production line workers who record machine events (start/stop/downtime) and production counts. They use the Shopfloor page on a tablet or desktop. |
| **Supervisors** | Production supervisors who review shift data, approve and lock shifts, manage staff accounts, and assign machine permissions. |
| **Executives** | Plant directors, COO, CEO, or management who need a high-level overview of OEE performance across the organization for decision-making. |
| **System Administrators** | IT personnel or system owners who configure master data (plants, lines, machines, products), manage users, and maintain system settings. |

## 1.4 High-Level System Workflow

The system follows this general workflow from data capture to reporting:

1. **Administrator sets up master data** - Companies, plants, production lines, machines, products (SKUs), shift schedules, downtime reasons, defect reasons, and production standards are configured.

2. **Administrator creates user accounts** - Users are created with appropriate roles (Staff, Supervisor, Executive) and assigned to companies.

3. **Supervisor assigns machine permissions** - Staff members are granted access to specific machines through individual permissions or permission groups.

4. **Staff records production data** - On the Shopfloor page, operators select their machine, choose a product (SKU), and record:
   - Production events: RUN, DOWNTIME (with reason), SETUP
   - Production counts: Good quantity and reject quantity

5. **System auto-detects current shift** - The system identifies which shift is currently active based on configured shift schedules.

6. **Supervisor reviews and approves** - On the Supervisor Dashboard, supervisors:
   - Review shift summaries with OEE metrics
   - Preview data timeline before recalculation
   - Recalculate OEE for the shift
   - Approve the shift
   - Lock the shift (prevents further modifications)

7. **Executive views performance reports** - The Executive Dashboard provides:
   - OEE snapshot with comparison to targets and previous periods
   - OEE trend charts
   - Top loss Pareto analysis
   - Line/machine ranking
   - Loss category breakdown
   - Attention panel for items needing immediate action

8. **All users can review activity history** - Recent Activity and Activity Log pages provide visibility into recorded changes.

## 1.5 System Limitations and Assumptions

1. **Web-based only** - The system runs in a web browser. There is no native mobile application. However, the Shopfloor page is optimized for tablet use.

2. **Internet required** - An active internet connection is required at all times. The system does not support offline data entry.

3. **Shift-based operations** - The system assumes production is organized in shifts. Shift schedules must be pre-configured before data can be recorded.

4. **Single product per RUN event** - Each RUN event is associated with one product (SKU). If the product changes during production, the system automatically stops the current event and starts a new one.

5. **No self-registration** - Users cannot create their own accounts. All accounts must be created by an Administrator or Supervisor.

6. **Company association required** - All users (except Administrators) must be associated with exactly one company.

7. **Time-based shift detection** - The system determines the current shift based on the server clock. Ensure the system clock is accurate.

8. **Browser compatibility** - The system is designed for modern browsers (Chrome, Firefox, Edge, Safari). Older browsers may not display correctly.

---

# PART 2: USER ROLES AND PERMISSIONS

The system implements four distinct roles. Each role has specific capabilities and restrictions enforced at the database level for security.

## 2.1 STAFF (Operator)

**Purpose:** The primary data entry role. Staff members record production events and counts on the shopfloor.

**What they can see:**
- Dashboard - OEE overview for their company (today only, no time filter)
- Shopfloor - Event capture and production count entry
- Monitor - Real-time machine status view
- Recent Activity - Only their own recorded activities

**What they can do:**
- Start and stop production events (RUN, DOWNTIME, SETUP) on machines they have permission to access
- Record production counts (good and reject quantities) on their permitted machines
- View their own event timeline and production count history
- Edit or delete their own production events and counts (only if the shift is not locked)

**What they cannot do:**
- Access the Supervisor Dashboard
- Access the Executive Dashboard
- Access the Admin Setup page
- Access the Activity Log (raw audit trail)
- View or modify other users' data
- Approve, lock, or recalculate shifts
- Create or manage user accounts
- Modify master data (plants, lines, machines, etc.)
- Edit or delete records after a shift has been locked
- Use the time period filter on the Dashboard

**Responsibility:**
- Accurately record production events in real-time
- Select the correct product (SKU) before starting a RUN event
- Record production counts with correct good and reject quantities
- Select appropriate downtime reasons when stopping for downtime

## 2.2 SUPERVISOR

**Purpose:** Oversees production operations, manages shift workflows, and supervises staff within their company.

**What they can see:**
- Dashboard - OEE overview with time period filter (today, yesterday, 7/14/30/60 days)
- Shopfloor - Full event capture capabilities
- Monitor - Real-time machine status view
- Supervisor Dashboard - Shift summaries, OEE metrics, staff management, permission groups, audit logs
- Recent Activity - All activities within their company

**What they can do:**
- Everything a Staff member can do
- Access all machines within their company automatically (no individual machine permissions needed)
- Review shift summaries with OEE metrics (Availability, Performance, Quality, OEE)
- Preview event and count data before OEE recalculation
- Recalculate OEE for any shift in their company
- Approve shifts after OEE calculation
- Lock shifts to prevent further modifications
- Create new Staff accounts within their company
- Edit Staff account information (name, email, password)
- Create and manage machine permission groups
- Assign Staff members to permission groups
- Create production standards (machine-SKU benchmarks) inline from the Shopfloor page
- View audit logs for their plant
- Edit or delete any production event or count within their company

**What they cannot do:**
- Access the Admin Setup page
- Access the Activity Log (raw audit trail)
- Create Supervisor, Executive, or Admin accounts
- Manage users outside their company
- Modify master data (plants, lines, machines, products, reasons)
- Manage company-level settings

**Responsibility:**
- Ensure data quality by reviewing shift data before approval
- Follow the workflow: Review, Recalculate, Approve, Lock
- Manage Staff accounts and machine permissions
- Monitor production performance and address issues

## 2.3 EXECUTIVE

**Purpose:** Read-only role for senior management to view high-level OEE performance dashboards.

**What they can see:**
- Dashboard - OEE overview with time period filter
- Executive Dashboard - Comprehensive OEE analytics with:
  - KPI Snapshot (A/P/Q/OEE with delta comparison)
  - OEE Trend chart (7/14/30 days)
  - Top Losses Pareto chart
  - Line/Machine ranking
  - Loss category breakdown
  - Attention panel for items needing focus
- Monitor - Real-time machine status view
- Recent Activity - All activities within their company

**What they can do:**
- View all dashboards and reports for their company
- Filter Executive Dashboard by time period (7/14/30 days)
- Use Fullscreen and Kiosk modes for TV display
- Access all plants within their company automatically

**What they cannot do:**
- Record production events or counts
- Approve, lock, or recalculate shifts
- Manage users or permissions
- Modify any data
- Access the Admin Setup page
- Access the Shopfloor event capture
- Access the Supervisor Dashboard

**Responsibility:**
- Review OEE performance regularly
- Identify trends and areas for improvement
- Make strategic decisions based on data

## 2.4 ADMIN (System Administrator)

**Purpose:** Full system access for configuring and managing the entire application across all companies.

**What they can see:**
- All pages and features in the system
- Data across all companies (after selecting a company context)

**What they can do:**
- Everything all other roles can do
- Select which company to work with (multi-company management)
- Switch between companies at any time via the sidebar
- Manage Companies (create, edit, activate/deactivate)
- Manage Plants (create, edit, activate/deactivate per company)
- Manage Production Lines (create, edit, activate/deactivate per company)
- Manage Machines (create, edit with OEE targets, cycle times, time units, activate/deactivate)
- Manage Products / SKUs (create, edit, activate/deactivate per company)
- Manage Production Standards (ideal cycle times and setup times per machine-SKU combination)
- Manage Downtime Reasons (create, edit with category: Planned/Unplanned/Breakdown/Changeover)
- Manage Defect Reasons (create, edit per company)
- Manage all User accounts (create with any role, edit email/password/name/role/company)
- Manage User Permissions (assign users to plants, lines, machines)
- Bulk import and export master data (Excel/CSV)
- View the raw Activity Log (audit trail) with full before/after data
- Edit or delete any production event or count in any company

**What they cannot do:**
- There are no restrictions on Admin actions within the system
- Note: Admin actions are still logged in the audit trail for accountability

**Responsibility:**
- Initial system setup and configuration
- Ongoing master data maintenance
- User account lifecycle management
- System health monitoring
- Data integrity oversight

---

# PART 3: USER MANUAL (END USER)

## 3.1 Login / Logout

### 3.1.1 Logging In

**Screen purpose:** Authenticate users to access the system.

**When to use:** Every time you need to access the system.

**Step-by-step:**

1. Open the system URL in your web browser.
2. You will see the login screen with the PNF OEE branding on the left and a login form on the right.
3. Enter your **Email** address in the email field.
4. Enter your **Password** in the password field.
5. Click the **Sign In** button.
6. If your credentials are correct, you will be redirected to the Dashboard.
7. If you are an Administrator, you will be prompted to select a company before proceeding.

**Validation rules:**
- Email must be a valid email format.
- Password must be at least 6 characters.

**What happens after signing in:**
- Your session is maintained until you explicitly sign out or close the browser.
- You are redirected to the Dashboard automatically.

**Common mistakes:**
- Entering incorrect email or password. Double-check your credentials. If you forgot your password, contact your Supervisor or Administrator.
- Using an unverified email. Your account must be verified by an Administrator before first use.

### 3.1.2 Company Selection (Admin Only)

**Screen purpose:** Allows Administrators to select which company to manage.

**When to use:** After logging in as an Admin, or when switching companies.

**Step-by-step:**

1. After login, the company selection screen appears automatically.
2. You will see a list of all active companies in the system.
3. Click on the company you wish to manage.
4. You will be redirected to the Dashboard in the context of the selected company.
5. To switch companies later, use the company switcher in the sidebar.

### 3.1.3 Logging Out

**Step-by-step:**

1. Locate the user profile section at the bottom of the left sidebar.
2. Click the **Logout** icon (arrow pointing right) next to your name.
3. You will be redirected to the login screen.
4. Your session is terminated and all cached data is cleared.

## 3.2 Navigation (Sidebar Menu)

**Screen purpose:** Provides access to all system pages based on your role.

**Structure:**

The left sidebar contains the following menu items (visibility depends on your role):

| Menu Item | Available To | Description |
|-----------|-------------|-------------|
| Dashboard | All roles | OEE overview with gauges and machine status |
| Shopfloor | All roles | Record production events and counts |
| Monitor | All roles | Real-time machine status board |
| Supervisor | Supervisor, Admin | Shift management, staff management, audit logs |
| Executive | Executive, Admin | High-level OEE performance dashboard |
| Recent Activity | All roles | View recent production activities |
| Activity Log | Admin only | Raw audit trail with full data history |
| Admin Setup | Admin only | Master data and system configuration |

**Sidebar features:**
- **Collapse/Expand:** Click the collapse button at the bottom to minimize the sidebar (desktop only).
- **Company Switcher:** Admins see a company selector at the top of the sidebar to switch between companies.
- **User Profile:** Your name, role, and company are displayed at the bottom of the sidebar.
- **Mobile Menu:** On mobile devices, tap the hamburger menu icon (three lines) at the top-left corner to open the sidebar.

## 3.3 Dashboard

**Screen purpose:** Provides a real-time overview of OEE performance and machine statuses for your company.

**When to use:** As the first screen after login to get a quick snapshot of production performance.

### 3.3.1 OEE Gauges

The dashboard displays four speedometer-style gauges:

- **Overall OEE** (large, center) - The combined OEE score. Displays "World Class" (85%+), "Acceptable" (60-84%), or "Needs Improvement" (below 60%).
- **Availability** - Percentage of planned time the machine was actually running.
- **Performance** - Speed efficiency compared to the ideal cycle time.
- **Quality** - Percentage of good products out of total produced.

### 3.3.2 Machine Status Summary

Four status cards show the count of machines in each state:

- **Running** (green) - Machines currently producing.
- **Idle** (gray) - Machines with no active event.
- **Stopped** (red) - Machines in downtime.
- **Maintenance** (yellow) - Machines in setup/changeover.

### 3.3.3 OEE Trend Chart

A line chart showing OEE trends over the selected time period. The chart displays daily OEE values to help identify patterns and trends.

### 3.3.4 Machine Grid

Displays all machines as cards showing:
- Machine name and code
- Current status (color-coded)
- Current OEE percentage
- Current product being produced (if running)

**Interaction:** Click any machine card to open a detailed drill-down view showing:
- OEE component breakdown (A/P/Q)
- Production statistics (good count, reject count, run time, downtime)
- OEE history chart (7 or 30 days)

### 3.3.5 Filters

- **Time Period** (Supervisor, Executive, Admin only): Select from Today, Yesterday, 7 days, 14 days, 30 days, or 60 days.
- **Line Filter:** Filter machines by production line.

### 3.3.6 Fullscreen and Kiosk Modes

- **Fullscreen:** Expands the dashboard to fill the entire screen. Press Escape to exit.
- **Kiosk Mode:** Designed for TV displays. Hides all filters and control buttons. Shows only data. Displays a real-time clock and countdown timer for the 30-second auto-refresh cycle.

## 3.4 Shopfloor (Event Capture)

**Screen purpose:** The primary data entry screen for operators to record production events and counts.

**When to use:** Throughout the shift to record machine activity in real-time.

### 3.4.1 Event Capture Tab

#### Step 1: Select Machine

1. Select a **Plant** from the dropdown.
2. Select a **Line** from the dropdown (options filtered by selected plant).
3. Select a **Machine** from the grid (options filtered by selected line). The selected machine is highlighted.

#### Step 2: Select Product / SKU

1. After selecting a machine, the SKU selector appears.
2. Browse or search for the product you are producing.
3. Select the product. If a production standard exists for this machine-SKU combination, the benchmark card will display:
   - Ideal Cycle Time
   - Standard Setup Time
   - Target Quality

**Important:** You must select a SKU before starting a RUN event.

#### Step 3: Current Shift Information

A banner automatically displays the current shift information:
- Shift name
- Date
- Planned time
- Approval status

If the shift is **Locked**, a red banner appears indicating that no modifications can be made.

#### Step 4: Start/Stop Events

**Starting a RUN event:**
1. Ensure a product (SKU) is selected.
2. Click the **Start Run** button (green).
3. The system records the start time automatically.

**Starting a DOWNTIME event:**
1. Click the **Downtime** button (red).
2. Select a downtime reason from the dropdown (categorized as Planned, Unplanned, Breakdown, or Changeover).
3. Optionally add notes.
4. Click confirm to start the downtime event.

**Starting a SETUP event:**
1. Click the **Setup** button (yellow).
2. Optionally add notes.
3. Click confirm to start the setup event.

**Stopping any event:**
1. Click the **Stop** button.
2. The system records the end time automatically.
3. The stopped event appears in the timeline below.

**Validation rules:**
- Only one event can be active per machine at a time.
- Starting a new event automatically stops any active event.
- Events cannot be started if the current shift is locked.
- A product must be selected before starting a RUN event.

**Changing SKU during production:**
- If you change the selected SKU while a RUN event is active, the system automatically stops the current RUN and starts a new RUN with the new SKU.

#### Step 5: Add Production Counts

1. After some production has occurred, enter the **Good Quantity** produced.
2. Enter the **Reject Quantity** (if any, defaults to 0).
3. Optionally select a **Defect Reason** if there are rejects.
4. Optionally add **Notes**.
5. Click **Submit** to record the count.

**Validation rules:**
- Good quantity must be zero or greater.
- Reject quantity must be zero or greater.
- If reject quantity is greater than zero, a defect reason should be selected.

#### Step 6: View Event Timeline

The timeline shows all events recorded for the selected machine during the current shift:
- Event type (RUN/DOWNTIME/SETUP) with color coding
- Start and end times
- Duration
- Associated product and reason (if applicable)

#### Step 7: View Production Count History

A summary of all production counts recorded for the current shift, showing:
- Timestamp
- Good quantity
- Reject quantity
- Defect reason
- Notes
- Running totals for the shift

### 3.4.2 My Machines Tab

**Screen purpose:** Quick view of all machines assigned to you and their current status.

**When to use:** To monitor the status of your assigned machines without selecting each one individually.

This tab displays cards for all machines you have permission to operate, showing:
- Machine name and code
- Current status
- Current event type
- Current product

## 3.5 Production Monitor

**Screen purpose:** A read-only, real-time view of all machine statuses across the factory.

**When to use:** For monitoring production floor status, especially when displayed on a TV or large screen.

**Features:**
- **Status summary bar:** Shows counts of Running, Stopped, Setup, and Idle machines.
- **Machine grid:** Cards for each machine showing status, current event, and OEE.
- **Live indicator:** A pulsing "Live" badge confirms real-time data updates.
- **Filters:** Filter by status or production line.
- **Fullscreen/Kiosk modes:** Same as Dashboard for TV display.

**Interaction:** Click any machine card to open a control sheet showing event details and production information.

## 3.6 Recent Activity

**Screen purpose:** View a timeline of recent production activities in a human-readable format.

**When to use:** To review what has been recorded recently, verify your entries, or check on team activity.

**Features:**
- **Toggle Chips:** Filter by category:
  - All - Show everything
  - Production Events (combines Running, Downtime, Setup)
  - Production Counts
  - Shift Approvals
  - OEE Snapshots
  - Other
- **Action Filter:** Filter by action type (Create, Edit, Delete).
- **Search:** Search by machine name, product code, or user name.
- **Session Grouping:** Related activities are grouped into sessions for easier reading.
- **Date Grouping:** Activities are organized by date with Thai date formatting.

**Role-based visibility:**
- **Staff:** See only their own activities. A badge "แสดงเฉพาะของคุณ" (Showing only yours) confirms this.
- **Supervisor/Admin:** See all activities within their company.

**Editing and Deleting:**
- Staff can edit or delete their own production events and counts (if the shift is not locked).
- Supervisors and Admins can edit or delete any production event or count within their company.
- Click the edit or delete icon on any editable record to modify or remove it.

## 3.7 Activity Log (Admin Only)

**Screen purpose:** Raw audit trail showing all system changes with full before/after data.

**When to use:** For detailed investigation of data changes, compliance auditing, or troubleshooting.

**Features:**
- **Date range filter:** Select start and end dates.
- **Entity type filter:** Filter by type of record changed.
- **Action filter:** Filter by INSERT, UPDATE, or DELETE.
- **Search:** Text search across user names and entity types.
- **Expandable details:** Click any log entry to see the full before and after JSON data.

**Note:** This page shows raw technical data and is intended for system administrators only.

---

# PART 4: ADMIN MANUAL

## 4.1 Admin Dashboard Overview

The Admin Setup page is organized into tabs, each managing a different aspect of the system:

| Tab | Purpose |
|-----|---------|
| Users | Create and manage user accounts |
| Companies | Manage company records |
| Plants | Manage manufacturing plants |
| Lines | Manage production lines within plants |
| Machines | Manage individual machines within lines |
| Products | Manage product catalog (SKUs) |
| Standards | Manage production standards (machine-SKU benchmarks) |
| Downtime | Manage downtime reason codes |
| Defects | Manage defect reason codes |
| Permissions | Assign users to plants, lines, and machines |

## 4.2 User and Role Management

### 4.2.1 Creating a User Account

1. Navigate to **Admin Setup** and select the **Users** tab.
2. Click **Add User** or the "+" button.
3. Fill in the required fields:
   - **Full Name** - The user's display name.
   - **Email** - Must be unique across the system. This is used for login.
   - **Password** - Minimum 6 characters.
   - **Role** - Select one: STAFF, SUPERVISOR, EXECUTIVE, or ADMIN.
   - **Company** - Required for STAFF, SUPERVISOR, and EXECUTIVE roles. Admin does not require a company.
4. Click **Save** or **Create**.

**Important considerations:**
- Each user can have only one role.
- Users cannot change their own role.
- STAFF, SUPERVISOR, and EXECUTIVE must be assigned to a company. The system enforces this at the database level.
- Email addresses must be unique. Two users cannot have the same email.

### 4.2.2 Editing a User Account

1. Find the user in the Users list.
2. Click the **Edit** button.
3. You can modify:
   - Full Name
   - Email (updating email does not disrupt the user's active session)
   - Password
   - Role
   - Company
4. Click **Save**.

### 4.2.3 User Account Lifecycle

- **Active:** User can log in and use the system.
- **Deleted:** Only possible by removing the user from the system entirely. There is no soft-delete for user accounts.

### 4.2.4 Role Changes and Their Impact

Changing a user's role immediately affects their access:
- Upgrading STAFF to SUPERVISOR gives them access to the Supervisor Dashboard and all machines in their company.
- Downgrading SUPERVISOR to STAFF removes Supervisor access and limits them to individually assigned machines.
- Any role change takes effect on the user's next page load.

## 4.3 Master Data Management

### 4.3.1 Company Management

**Purpose:** Manage the companies (tenants) in the system.

**Fields:**
- **Name** (required) - Company display name.
- **Code** (optional) - Short code for identification.
- **Is Active** - Toggle to enable/disable the company.

**Impact of deactivating a company:**
- Users in the company can still log in but may not see expected data.
- It is recommended to deactivate all users in the company first.

### 4.3.2 Plant Management

**Purpose:** Manage manufacturing plants within a company.

**Fields:**
- **Name** (required) - Plant name.
- **Code** (optional) - Short identifier.
- **Company** (required) - The company this plant belongs to.
- **Is Active** - Toggle to enable/disable.

**Dependencies:** Plants contain Lines. Deactivating a plant does not automatically deactivate its lines.

### 4.3.3 Line Management

**Purpose:** Manage production lines within plants.

**Fields:**
- **Name** (required) - Line name.
- **Code** (optional) - Short identifier.
- **Plant** (required) - The plant this line belongs to.
- **Company** (required) - Auto-set based on plant.
- **Is Active** - Toggle to enable/disable.

**Dependencies:** Lines contain Machines. Deactivating a line does not automatically deactivate its machines.

### 4.3.4 Machine Management

**Purpose:** Manage individual machines within production lines.

**Fields:**
- **Name** (required) - Machine name.
- **Code** (required) - Unique machine code used for identification and bulk imports.
- **Line** (required) - The line this machine belongs to.
- **Company** (required) - Auto-set based on line.
- **Ideal Cycle Time** (required) - Default cycle time in seconds. This is the baseline for performance calculation.
- **Time Unit** - Display preference (seconds or minutes). The database always stores values in seconds.
- **Target OEE** (optional) - OEE target percentage for this machine.
- **Target Availability** (optional) - Availability target percentage.
- **Target Performance** (optional) - Performance target percentage.
- **Target Quality** (optional) - Quality target percentage.
- **Is Active** - Toggle to enable/disable.

**Important:** The machine code must be unique within the company. It is used for matching during bulk imports.

### 4.3.5 Product (SKU) Management

**Purpose:** Manage the product catalog.

**Fields:**
- **Name** (required) - Product name.
- **Code** (required) - Unique product code (SKU). Used for identification and bulk imports.
- **Description** (optional) - Additional product information.
- **Company** (required) - The company this product belongs to.
- **Is Active** - Toggle to enable/disable.

### 4.3.6 Production Standards Management

**Purpose:** Define ideal cycle times and setup times for specific machine-product (SKU) combinations. These override the machine's default cycle time when a specific product is being produced.

**Fields:**
- **Machine** (required) - Select the machine.
- **Product** (required) - Select the product (SKU).
- **Ideal Cycle Time** (required) - Ideal cycle time in seconds for this specific machine-product combination.
- **Standard Setup Time** (required) - Expected setup/changeover time in seconds.
- **Target Quality** (required) - Quality target percentage for this combination.
- **Company** (required) - Auto-set.
- **Is Active** - Toggle to enable/disable.

**How it works:**
- When a staff member selects a machine and product on the Shopfloor, the system looks for a matching production standard.
- If found, the standard's cycle time is used for OEE performance calculation instead of the machine's default.
- If no standard exists, the machine's default ideal cycle time is used.

### 4.3.7 Downtime Reason Management

**Purpose:** Define the reason codes available when recording downtime events.

**Fields:**
- **Name** (required) - Reason description.
- **Code** (required) - Unique code.
- **Category** (required) - One of:
  - **PLANNED** - Scheduled downtime (e.g., breaks, planned maintenance).
  - **UNPLANNED** - Unexpected stops (e.g., material shortage).
  - **BREAKDOWN** - Equipment failure.
  - **CHANGEOVER** - Product changeover.
- **Company** (required) - The company this reason belongs to.
- **Is Active** - Toggle to enable/disable.

**Impact:** Categories are used in the Executive Dashboard's Loss Category analysis to group losses.

### 4.3.8 Defect Reason Management

**Purpose:** Define the reason codes available when recording reject quantities.

**Fields:**
- **Name** (required) - Defect description.
- **Code** (required) - Unique code.
- **Company** (required) - The company this reason belongs to.
- **Is Active** - Toggle to enable/disable.

## 4.4 System Configuration: Permissions

### 4.4.1 Direct Permission Assignment

On the **Permissions** tab, administrators can assign users access to specific:
- **Plants** - User can see data for machines in the plant.
- **Lines** - User can see data for machines in the line.
- **Machines** - User can operate and record events for the machine.

**Note:** Supervisors and Admins automatically have access to all machines in their company. Direct permissions are primarily for Staff members.

### 4.4.2 Permission Groups (Supervisor Feature)

Supervisors can create permission groups on the Supervisor Dashboard:

1. Navigate to **Supervisor Dashboard** and select the **Permission Groups** tab.
2. Click **Create Group**.
3. Enter a group name and description.
4. Select machines to include in the group.
5. Assign staff members to the group.

**Benefit:** Instead of assigning machines one by one, create a group (e.g., "Assembly Line A Operators") and assign staff to it. All machines in the group become accessible to all assigned staff.

## 4.5 Bulk Import and Export

### 4.5.1 Import (Excel/CSV)

Master data can be bulk imported using Excel (.xlsx) or CSV files:

1. Navigate to the appropriate tab in Admin Setup (e.g., Machines, Products).
2. Click the **Import** button.
3. Select your file.
4. The system performs case-insensitive matching using unique codes (Machine Code, Product Code).
5. Existing records are updated; new records are created.
6. Review the import summary for any errors.

**Import requirements:**
- Files must include the required columns with correct headers.
- Machine and Product codes must be unique within the company.
- Referenced entities (e.g., Plant for a Line) must already exist in the system.

### 4.5.2 Export (Excel/CSV)

1. Navigate to the appropriate tab.
2. Click the **Export** button.
3. Choose Excel or CSV format.
4. Excel exports include visual formatting with color-coded OEE performance indicators (Green/Yellow/Red).

## 4.6 Data Lifecycle

### 4.6.1 Production Data Lifecycle

1. **Created** - Staff records an event or count on the Shopfloor. Status: DRAFT.
2. **Reviewed** - Supervisor views the shift summary and OEE metrics.
3. **Recalculated** - Supervisor triggers OEE recalculation after reviewing the data timeline.
4. **Approved** - Supervisor approves the shift. Status: APPROVED.
5. **Locked** - Supervisor locks the shift. Status: LOCKED. Data is now immutable.

### 4.6.2 Master Data Lifecycle

1. **Created** - Admin creates a new record (plant, line, machine, etc.).
2. **Updated** - Admin modifies the record as needed.
3. **Deactivated** - Admin sets "Is Active" to false. The record is hidden from selection lists but not deleted. Historical references remain intact.

**Important:** Master data records are never physically deleted to preserve referential integrity with historical production data.

## 4.7 Impact of Admin Actions

| Action | Impact |
|--------|--------|
| Deactivating a machine | Machine no longer appears in Shopfloor selection. Historical data is preserved. |
| Changing a user's role | Immediately changes their access level. Takes effect on next page load. |
| Changing a user's company | Immediately changes which data they can see. Staff lose machine permissions from the old company. |
| Modifying a production standard | Future OEE calculations use the new values. Already-locked shifts are not affected. |
| Deactivating a downtime reason | Reason no longer appears in dropdown. Historical events that used this reason are preserved. |
| Deactivating a product | Product no longer appears in SKU selector. Historical events that referenced this product are preserved. |

**Caution:** Always consider the downstream effects before making changes. Deactivating master data does not affect historical records but prevents future use.

---

# PART 5: DATA AND SYSTEM BEHAVIOR

## 5.1 How Data Flows Between Screens

### 5.1.1 Shopfloor to Supervisor

1. Staff records events and counts on the Shopfloor page.
2. Data is saved to the `production_events` and `production_counts` tables.
3. The Supervisor Dashboard reads from the `v_shift_summary` view, which aggregates data by shift.
4. When the Supervisor clicks "Recalculate OEE," the system calls `rpc_recalc_oee_for_shift`, which:
   - Reads all events and counts for the shift.
   - Calculates A, P, Q, and OEE for each machine.
   - Writes results to the `oee_snapshots` table.

### 5.1.2 Supervisor to Executive

1. After OEE is recalculated and the shift is approved/locked, snapshot data is finalized.
2. The Executive Dashboard reads exclusively from `oee_snapshots`.
3. Trend data is aggregated from snapshots by date.
4. Pareto data is derived from `production_events` joined with `downtime_reasons`.
5. Line ranking is calculated by aggregating machine-level snapshots up to line level.

### 5.1.3 All Changes to Audit Trail

Every INSERT, UPDATE, or DELETE on production tables triggers an audit log entry:
- The `before_json` captures the record state before the change.
- The `after_json` captures the record state after the change.
- The `actor_user_id` identifies who made the change.
- Both Activity Log and Recent Activity read from the `v_audit_logs_readable` view.

## 5.2 Relationships Between Key Data Entities

The system follows a hierarchical structure:

```
Company
  |-- Plant(s)
  |     |-- Line(s)
  |           |-- Machine(s)
  |                 |-- Production Events
  |                 |-- Production Counts
  |                 |-- OEE Snapshots
  |
  |-- Product(s) / SKU(s)
  |     |-- (linked to Machines via Production Standards)
  |
  |-- Downtime Reasons
  |-- Defect Reasons
  |-- User Profiles
        |-- User Permissions (Plant/Line/Machine)
        |-- Permission Groups
```

**Key relationships:**
- Each Machine belongs to exactly one Line, which belongs to one Plant, which belongs to one Company.
- Production Standards link a Machine to a Product with specific benchmark values.
- Production Events belong to a Machine and a Shift Calendar entry.
- A Shift Calendar entry links a Shift definition to a specific Plant and date.

## 5.3 How the System Ensures Data Accuracy

1. **Database-level validation:** All business rules (overlap prevention, lock enforcement) are enforced by database triggers and functions, not by the frontend. This means rules cannot be bypassed.

2. **Overlap prevention:** The system prevents two events from being active on the same machine simultaneously. Starting a new event automatically ends any active event.

3. **Lock enforcement:** Once a shift is locked, the database rejects any INSERT, UPDATE, or DELETE on production_events and production_counts for that shift.

4. **Audit trail:** Every change is automatically logged by database triggers, capturing the actor, timestamp, and before/after states.

5. **Role-based access (RLS):** Row Level Security policies on all tables ensure users can only access data they are authorized to see. This is enforced at the database level, not in the application code.

6. **Recalculation preview:** Before recalculating OEE, supervisors can review the full event timeline and count history to identify data issues.

## 5.4 How Permissions Affect Data Visibility

| Role | Data Visibility |
|------|----------------|
| STAFF | Can only see machines they have explicit permission for. Recent Activity shows only their own records. |
| SUPERVISOR | Can see all machines and data within their company. Recent Activity shows all company records. |
| EXECUTIVE | Can see all data within their company (read-only). |
| ADMIN | Can see all data across all companies (must select company context). |

Permission checks are performed by database functions (`has_machine_permission`, `has_line_permission`, `has_plant_permission`). These functions consider:
- Direct individual permissions.
- Permission group memberships.
- Role-based automatic access (Supervisors and Admins get all machines in their company).

---

# PART 6: COMMON ISSUES AND TROUBLESHOOTING

## 6.1 Login Problems

| Problem | Possible Cause | Solution |
|---------|---------------|----------|
| "Failed to sign in" error | Incorrect email or password | Verify your email and password. Contact your Supervisor or Admin to reset your password. |
| Stuck on loading screen | Slow internet connection or browser issue | Refresh the page. Try clearing browser cache. Check your internet connection. |
| Redirected back to login after signing in | Session expired or authentication issue | Clear browser cache and cookies. Try signing in again. |
| Admin stuck on company selection | No active companies exist | Contact another Admin to create or activate a company. |

## 6.2 Permission Issues

| Problem | Possible Cause | Solution |
|---------|---------------|----------|
| "ไม่มีสิทธิ์เข้าถึง" (No access) on Supervisor page | Your role is not Supervisor or Admin | Contact your Admin to change your role if you need Supervisor access. |
| Cannot see machines on Shopfloor | No machine permissions assigned | Contact your Supervisor to assign you to machines or a permission group. |
| Cannot start events | Shift is locked | The current shift has been locked by a Supervisor. You can only record data for unlocked shifts. |
| Cannot see Executive Dashboard | Your role is not Executive or Admin | Contact your Admin to update your role. |

## 6.3 Data Not Appearing

| Problem | Possible Cause | Solution |
|---------|---------------|----------|
| No machines shown on Dashboard | No company selected (Admin) or no machines configured | Admin: ensure a company is selected. Check that machines are created and active in Admin Setup. |
| No shift information on Shopfloor | No shift calendar configured for today | Contact your Admin to set up shift schedules. |
| OEE shows 0% on Dashboard | OEE has not been calculated yet | Supervisor must recalculate OEE for the shift on the Supervisor Dashboard. |
| Executive Dashboard shows no data | No OEE snapshots exist for the selected time period | Ensure shifts have been recalculated and approved. |
| Recent Activity is empty | No production records exist or filter is too restrictive | Try changing the filter chips or clearing the search field. |

## 6.4 Validation Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "กรุณาเลือก SKU ก่อนเริ่มงาน" | Tried to start RUN without selecting a product | Select a product from the SKU selector before clicking Start Run. |
| "Failed to start event" | Various: shift locked, no active shift, permission denied | Check that the shift is not locked. Verify you have permission for the machine. |
| "No benchmark defined for [SKU] on [Machine]" | No production standard exists for this machine-SKU combination | This is a warning, not a blocker. Contact your Supervisor or Admin to create a production standard. |

## 6.5 Recommended First Checks Before Contacting IT

1. **Refresh the page** - Many display issues are resolved by a simple page refresh.
2. **Check your internet connection** - The system requires a stable connection.
3. **Try a different browser** - Use Chrome, Firefox, or Edge for best compatibility.
4. **Clear browser cache** - Old cached data can sometimes cause display issues.
5. **Check if the issue affects other users** - If only you are affected, the issue may be account-specific.
6. **Note the exact error message** - Screenshot any error messages to help IT diagnose the issue.
7. **Check the time** - If shift-related features are not working, verify that the current time falls within a configured shift window.

---

# PART 7: BEST PRACTICES AND OPERATION GUIDELINES

## 7.1 How Users Should Use the System Correctly

### For Staff (Operators)

1. **Record events in real-time** - Start and stop events as they happen, not at the end of the shift. This ensures accurate duration calculations.
2. **Always select the correct SKU** - Performance calculations depend on the correct product's ideal cycle time.
3. **Record counts regularly** - Do not wait until the end of the shift to enter all counts. Record them periodically for better data granularity.
4. **Always select a downtime reason** - When recording downtime, always specify the reason. This data is critical for loss analysis.
5. **Use notes for context** - Add notes to events when the reason code alone does not fully explain the situation.

### For Supervisors

1. **Review data before recalculating** - Always use the preview dialog to verify events and counts before triggering OEE recalculation.
2. **Follow the workflow in order** - Review, Recalculate, Approve, Lock. Do not skip steps.
3. **Lock shifts promptly** - Lock approved shifts to prevent retroactive data changes.
4. **Manage staff permissions proactively** - When new staff join, assign machine permissions immediately.
5. **Use permission groups** - For teams that share the same set of machines, create a permission group rather than assigning machines individually.

### For Executives

1. **Review dashboards regularly** - Check the Executive Dashboard at least daily to stay informed.
2. **Focus on the Attention Panel** - The attention panel highlights items needing immediate action.
3. **Use Kiosk Mode for team visibility** - Display the Executive Dashboard on a TV in the meeting room or production office.

### For Administrators

1. **Complete master data setup before go-live** - Ensure all plants, lines, machines, products, shifts, and reasons are configured before operators start using the system.
2. **Create production standards** - Define ideal cycle times for all machine-product combinations to ensure accurate OEE calculations.
3. **Set realistic OEE targets** - Configure machine-level OEE targets that are achievable but challenging.
4. **Regularly audit user accounts** - Review active accounts and deactivate those of departed employees.

## 7.2 Do's and Don'ts

### Do's

- Do record events as they happen in real-time.
- Do use specific downtime reasons instead of generic ones.
- Do review the preview timeline before recalculating OEE.
- Do lock shifts after approval to maintain data integrity.
- Do use permission groups for team-based machine access.
- Do export data regularly for backup and offline analysis.
- Do set up production standards for accurate performance calculations.

### Don'ts

- Do not wait until the end of the shift to enter all events at once.
- Do not share login credentials with other users.
- Do not leave events running when the machine is actually stopped.
- Do not skip the recalculation step before approving a shift.
- Do not deactivate master data without considering the impact on production workflows.
- Do not modify locked shift data (the system will prevent this, but do not attempt workarounds).
- Do not create generic "Other" reasons for every downtime event - use specific reasons for meaningful analysis.

## 7.3 Data Entry Discipline

1. **Accuracy over speed** - Take a moment to select the correct machine, product, and reason. Incorrect data leads to misleading OEE reports.
2. **Consistency** - Use the same reason codes consistently across shifts and teams. Agree on definitions.
3. **Completeness** - Every machine should have events recorded throughout the shift. Gaps in events lead to inaccurate availability calculations.
4. **Timeliness** - Record events as close to real-time as possible. Recording from memory at the end of the shift introduces errors.

## 7.4 Recommended Daily Operations

| Time | Action | Who |
|------|--------|-----|
| Start of shift | Select machine and SKU, start RUN event | Staff |
| During shift | Record events as they occur, enter counts periodically | Staff |
| End of shift | Ensure all events are stopped, final counts entered | Staff |
| After shift ends | Review shift summary, check for data gaps | Supervisor |
| After review | Preview timeline, recalculate OEE | Supervisor |
| After recalculation | Verify OEE values, approve shift | Supervisor |
| After approval | Lock the shift | Supervisor |
| Daily/Weekly | Review Executive Dashboard for trends | Executive |

## 7.5 Recommended Monthly Operations

| Action | Who |
|--------|-----|
| Review and deactivate unused reason codes | Admin |
| Audit user accounts (deactivate departed employees) | Admin |
| Review production standards for accuracy | Admin / Supervisor |
| Export OEE data for management reporting | Supervisor / Executive |
| Review loss Pareto for improvement priorities | Executive / Supervisor |
| Update machine OEE targets based on recent performance | Admin |

---

*End of Document*

**PNF OEE System - User Manual and Admin Manual**  
**Version 1.0 - February 2026**  
**Designed and Developed by Arnon Arpaket**
