# Message Stack UI Implementation

## Overview
Implemented the **Message Stack** in the top bar (`Header`), providing a centralized place for system notifications (info, warning, error). The design follows the "Industrial / Soft CRT" style guide.

## Changes

### 1. Style Definitions (`styles.css`)
Added dedicated CSS classes for the message dropdown to replace previous inline styles:
- `.message-stack-dropdown`: The main container with `panel-bg` and `shadow-md`.
- `.message-stack-header`: Sticky header with "Safety Orange" or standard text colors.
- `.message-item`: Each message row with a left colored indicator strip based on severity.
- `.message-level`: Colored indicators for INFO/WARNING/ERROR.

### 2. Header Component (`components/Layout/Header.tsx`)
Refactored `renderMessagesPanel` to use the new CSS classes.
- **Sorting**: Messages are now sorted by timestamp (newest first).
- **Formatting**: Timestamps use `toLocaleTimeString()` for a cleaner look.
- **Visuals**: Added a colored strip on the left of each message to indicate severity (Green=Info, Amber=Warning, Red=Error).

## Visual Verification
- **Button**: Located in the top-right "Control Deck". Shows a count `(N)` when messages exist.
- **Dropdown**: Appears on click, floating above the canvas.
- **Content**: Sticky header with "Clear All" button. Scrollable list of messages.
- **Empty State**: Displays "No active messages" when empty.
