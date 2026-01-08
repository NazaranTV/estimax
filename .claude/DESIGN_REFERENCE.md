# Estimax Design System Reference

## Overview
This application has been fully redesigned with a Railway.app-inspired aesthetic. All styling follows Railway's dark theme with purple accents and clean, modern design patterns.

## Color Palette

### Background Colors
- **Main Background**: `#13111C` - The primary page background
- **Dot Pattern**: `#292834` - Visible dots in the background pattern (24px grid)
- **Card Background**: `#181622` - Used for main content cards and modals
- **Summary Cards**: `#211F2D` - Used for summary cards (Outstanding, Unpaid invoices, etc.) and buttons
- **Elevated Elements**: `#27272a` - Used for elevated/hover states
- **Hover State**: `#272532` - Lighter hover color for interactive elements

### Accent Colors
- **Primary Purple**: `#7c3aed` (--accent-primary) - Main accent color
- **Purple Hover**: `#8b5cf6` (--accent-hover) - Hover state for purple elements
- **Purple Soft**: `rgba(124, 58, 237, 0.1)` - Transparent purple for backgrounds

### Borders
- **Subtle**: `rgba(255, 255, 255, 0.08)` - Very subtle borders
- **Normal**: `rgba(255, 255, 255, 0.1)` - Standard borders
- **Strong**: `rgba(255, 255, 255, 0.15)` - More prominent borders

### Text Colors
- **Primary Text**: `#ffffff` (--text-primary) - Main text
- **Secondary Text**: `#a1a1a1` (--text-secondary) - Less important text
- **Tertiary Text**: `#6b6b6b` (--text-tertiary) - De-emphasized text
- **Muted Text**: `#525252` (--text-muted) - Placeholder text

## Navigation

### Structure
All pages use the same Railway-style tab navigation:
```html
<nav class="nav">
  <div class="nav__inner">
    <button class="nav__item active">Overview</button>
    <button class="nav__item">Estimates</button>
    <!-- etc -->
  </div>
</nav>
```

### Styling
- **Centered tabs** with `justify-content: center`
- **Active state**: Purple underline (2px) at bottom with `.active` class
- **No pills or boxes** - clean tabs with underlines only
- **Purple underline** via `::after` pseudo-element on `.nav__item.active`
- **Font**: 14px, medium weight (500)
- **Padding**: 14px vertical, no horizontal padding

## Buttons

### Default Button Style
```css
background: #211F2D;
border: 1px solid rgba(255, 255, 255, 0.1);
color: var(--text-primary);
```

### Button Variants
- **Primary**: Purple background (`--accent-primary`)
- **Ghost**: Transparent background, border only
- **Small**: Reduced padding (6px 12px)
- **Large**: Increased padding (14px 24px)

### Custom Buttons
- `.btn-client-selector` - Client selection button
- `.btn-add-item` - Add line item button
- `.btn-drag-handle` - Drag handle for reordering (cursor: grab)
- `.btn-remove` - Remove button (minus sign)
- `.btn-item-list` - Item list selection button
- `.btn-upload-photo` - Photo upload button
- `.btn-save-as-item` - Save as item button

All custom buttons follow the same `#211F2D` background with Railway borders.

## Cards & Containers

### Main Cards
```css
background: #181622;
border: 1px solid rgba(255, 255, 255, 0.1);
border-radius: var(--radius-lg); /* 14px */
padding: 24px;
```

### Summary Cards (Outstanding, Unpaid, etc.)
```css
background: #211F2D;
border: 1px solid #33323E;
box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.4); /* Creates depth effect */
border-radius: var(--radius-md); /* 10px */
max-width: 1200px; /* Prevents stretching on large screens */
```

### Document Cards (List items)
```css
background: #211F2D;
border: 1px solid #33323E;
```

## Forms & Inputs

### Input Fields
```css
background: #13111C; /* Same as main background */
border: 1px solid rgba(255, 255, 255, 0.1);
color: var(--text-primary);
```

### Search Inputs
- **Background**: `#13111C`
- **Border**: `rgba(255, 255, 255, 0.1)` (grey outline)
- **Focus**: Purple border with `box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.2)`
- **Magnifying glass icon**: Turns purple on focus (`#7c3aed`)

### Labels
```css
font-size: 13px;
font-weight: 500;
color: var(--text-secondary);
margin-bottom: 6px;
```

## Estimate Form Structure

### Layout
The estimate form (`estimate-form.html`) uses a clean sectioned layout:

1. **Form Header** - Title and close button
2. **Client Information Section** - Card with client fields
3. **Project Details Section** - Card with project fields
4. **Line Items Section** - Card with dynamic line items
5. **Summary Section** - Card with subtotal/total
6. **Notes Section** - Card with notes textarea
7. **Form Actions** - Save/Clear buttons

### Section Cards
```css
.form-section {
  background: #181622;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg);
  padding: 24px;
  gap: 32px; /* Between sections */
}
```

### Form Section Titles
```css
.form-section__title {
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: 12px;
  margin-bottom: 20px;
}
```

### Line Items
```css
.line-item {
  background: #211F2D;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  padding: 16px;
}
```

### Estimate Summary
```css
.estimate-summary {
  background: #211F2D;
  max-width: 400px;
  margin-left: auto; /* Right-aligned */
}

.summary-row--total .summary-value {
  color: var(--accent-primary); /* Purple total */
  font-size: 24px;
}
```

## Modals

### Structure
All modals follow this pattern:
```html
<div class="modal hidden">
  <div class="modal__backdrop"></div>
  <div class="modal__content">
    <div class="modal__header">
      <h3>Title</h3>
      <button class="btn small ghost">Close</button>
    </div>
    <div class="modal__body">
      <!-- Content -->
    </div>
  </div>
</div>
```

### Modal Content
```css
.modal__content {
  background: #1a1825; /* Slightly lighter for contrast */
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

### Modal Forms
Use `.modal-form` with `.form-field` wrappers:
```html
<form class="modal-form">
  <div class="form-field">
    <label>Name</label>
    <input name="name" placeholder="...">
  </div>
</form>
```

### Modal Lists
```css
.modal-list {
  max-height: 400px;
  overflow-y: auto;
  gap: 8px;
}

.client-card, .item-card {
  background: #211F2D;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 16px;
}
```

## Typography

### Font Family
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
```

### Headings
- **h1**: 32px, weight 600, letter-spacing -0.02em
- **h2**: 24px, weight 600, letter-spacing -0.015em
- **h3**: 18px, weight 600, letter-spacing -0.01em
- **h4**: 14px, weight 600

### Eyebrow Text
```css
.eyebrow {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
}
```

## Grid System

### Two Column Grid
```css
.grid.two {
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
```

### Three Column Grid
```css
.grid.three {
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
```

### Responsive
Both grids collapse to single column on mobile (< 768px)

## Page Layout

### Container
```css
.page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
}
```

### Form Container
```css
.form-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 32px 0;
}
```

## Key Files

### Stylesheets
- `style.css` - Main global styles with Railway design system
- `style-form.css` - Dedicated estimate form styling

### HTML Pages
- `index.html` - Main app with Overview page
- `estimate-form.html` - Estimate creation form
- `login.html` - Login page

### JavaScript
- `app.js` - Main application logic
- `form.js` - Form-specific functionality
- `auth.js` - Authentication

## Important CSS Classes to Know

### Filter/Pill Buttons
```css
.pill-nav button, .filters button {
  background: #181622;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.pill-nav button.active, .filters button.active {
  background: rgba(124, 58, 237, 0.15);
  border-color: rgba(124, 58, 237, 0.4);
  box-shadow: 0 0 8px rgba(124, 58, 237, 0.25);
}
```

### Status Pills
```css
.pill {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 999px;
}
```

## Background Pattern

### Dot Pattern
```css
body::before {
  background-image: radial-gradient(circle, #292834 1px, transparent 1px);
  background-size: 24px 24px;
}
```

### Purple Gradient Accent
```css
body::after {
  background: radial-gradient(ellipse at center, rgba(124, 58, 237, 0.08) 0%, transparent 60%);
  /* Top center radial gradient */
}
```

## Border Radius

- `--radius-sm`: 6px (small elements)
- `--radius-md`: 10px (medium cards)
- `--radius-lg`: 14px (large cards)

## Transitions

```css
--transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
```

## Shadows

- `--shadow-sm`: 0 1px 2px rgba(0, 0, 0, 0.3)
- `--shadow-md`: 0 4px 12px rgba(0, 0, 0, 0.4)
- `--shadow-lg`: 0 12px 32px rgba(0, 0, 0, 0.5)

## Purple Glow Effect

Used for active navigation, focused inputs, and active filter buttons:
```css
box-shadow:
  0 0 8px rgba(124, 58, 237, 0.25),
  0 0 16px rgba(124, 58, 237, 0.12);
```

## Responsive Breakpoints

- **Mobile**: < 768px
  - Single column grids
  - Reduced padding
  - Stacked form actions

## Design Principles

1. **Consistent Railway Aesthetic**: All elements match Railway.app's design language
2. **Dark Theme**: Primary background is very dark with lighter cards for hierarchy
3. **Purple Accents**: Use sparingly for important actions and active states
4. **Subtle Borders**: Low opacity white borders create definition without harshness
5. **Proper Spacing**: Generous whitespace (24px-32px gaps between sections)
6. **Clean Typography**: Inter font with proper weights and letter-spacing
7. **Card-Based Layout**: Content organized in Railway-style cards
8. **No Excessive Effects**: Minimal shadows and glows, focused on clarity

## Common Patterns

### Adding a New Section
```html
<div class="form-section">
  <h3 class="form-section__title">Section Title</h3>
  <!-- Content -->
</div>
```

### Adding Form Fields
```html
<div class="form-field">
  <label>Field Label</label>
  <input type="text" placeholder="...">
</div>
```

### Adding Interactive Cards
```html
<div class="client-card">
  <h4>Title</h4>
  <p>Subtitle or description</p>
</div>
```

## Notes for AI Assistance

- All new UI elements should match the Railway aesthetic described above
- Use the exact color values specified (don't approximate)
- Maintain consistent spacing (24px, 32px gaps)
- Always use proper card backgrounds (`#181622` or `#211F2D`)
- Keep borders subtle with low opacity
- Purple is for accents only (active states, primary buttons)
- Test on both desktop and mobile breakpoints
- Forms should use `.form-field` wrappers for proper structure
- Modals should follow the three-part structure (backdrop, content, header/body)
