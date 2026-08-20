# Mobile / desktop navigation contracts (Stage −1)

Implementation of bottom navigation, role IA, and gesture shells belongs to **Mobile UX / Desktop UX** stages — not Stage −1 runtime.

## Role mobile IA (target)

### Student
Bottom tabs: Home · Schedule · Chats · Materials · Profile  
Primary thumb actions: join lesson, open chat, open homework.

### Teacher
Bottom tabs: Today · Schedule · Students · Chats · More  
Desktop: dense sidebar + optional multi-pane (schedule | detail).

### Admin
Mobile: drawer hub (Users, Finance, Materials, Assessment, System)  
Desktop: full sidebar (current `Layout.jsx` evolves, does not fork).

## Mandatory constraints

- Safe areas / Dynamic Island / home indicator via existing `.safe-*` utilities
- Touch targets ≥ 44px (`min-h-touch`)
- Bottom sheets via DS `Drawer` / `Sheet`
- Do **not** adapt desktop layouts with only `lg:` hacks for new mobile flows — build mobile shells separately when that stage starts
