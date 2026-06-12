
Purpose: This document is meant to be pasted into an AI design/prototyping tool as a clear product brief. It defines the prototype scope, screen structure, user flows, content priorities, and visual direction for a simple and intuitive clickable web-app prototype.
1. What the judges should understand quickly
•	The app helps moviegoers discover nearby screenings, influence what gets shown through voting, and buy tickets for confirmed screenings.
•	Cinemas reduce risk by filling underused slots through a vote plus pre-sale threshold model.
•	The platform also supports private cinema bookings and gives partner cinemas a lightweight analytics dashboard.
•	The prototype must be self-explanatory without live presentation.
2. Recommended prototype scope
•	Use a focused 12-screen responsive web-app prototype.
•	Center the experience on the moviegoer flow. The first screen should immediately show nearby screenings and active voting campaigns.
•	Treat private booking as a compact but complete mini-feature.
•	Show the cinema dashboard as a concise admin preview, not a full product.
3. Primary users shown in the prototype
•	Moviegoer: discovers screenings, votes on campaigns, buys a ticket, or submits a private booking request.
•	Cinema partner/admin: reviews campaign performance, sees demand insights, and confirms a private booking request.
4. Core product model to communicate
•	Cinema on demand uses a hybrid model: the cinema opens a slot and candidate films; users vote; the winning film enters a reservation or pre-sale phase; the screening is confirmed only if the ticket threshold is reached.
•	Private booking is a separate flow where a user requests a cinema slot for a private event and the cinema later confirms it.
•	The dashboard shows how cinemas can track demand, campaign performance, and underused inventory.
5. Information architecture
•	Top navigation: Discover, Voting, Private Booking, My Tickets, For Cinemas.
•	Persistent global search and location control near the top.
•	Primary CTAs must be visible above the fold: Vote now, Reserve ticket, Start booking request.
•	Use simple state labels throughout: Voting open, Leading, On sale, Confirmed, At risk, Pending approval.
6. Recommended 12-screen prototype map
•	1. Home / Discover: hero search, nearby screenings, active voting campaigns, simple filters, recommended cinemas.
•	2. Screening detail (confirmed): film hero, cinema, date and time, price, synopsis, CTA to buy ticket.
•	3. Ticket checkout: simple quantity selector, price summary, purchase CTA.
•	4. Ticket success / QR ticket: confirmation state with QR-style ticket card and key details.
•	5. Voting campaigns list: cards for open campaigns with time left, current leader, progress, and CTA.
•	6. Voting campaign detail: slot info, candidate movies, vote interaction, threshold explanation, share and save controls.
•	7. Post-vote state: user sees their vote recorded, notified state, and what happens next.
•	8. Private booking browse / start: explain use cases and show available cinemas or slots.
•	9. Private booking request form: movie or content, date, time, guests, event type, extras, price estimate, submit CTA.
•	10. Booking request submitted: clear pending approval state and next steps.
•	11. Cinema dashboard home: KPI cards, active campaigns, at-risk campaigns, demand highlights, next recommended slot.
•	12. Cinema booking request detail / confirmation: admin review panel with request data, estimated revenue, approve or decline.
•	The application name is Kinora, please use the full name as a logo in the prototype. The idea detail for the logo can be letter K in Kinora that looks like a camera.
7. Main user flows
•	Flow A (main): Discover to Screening detail to Checkout to Ticket success.
•	Flow B (core innovation): Discover or Voting to Campaign detail to Vote to Post-vote explanation.
•	Flow C (supporting value): Private Booking to Request form to Submitted.
•	Flow D (partner value): For Cinemas to Dashboard to Booking request detail.
8. What each screen must communicate
•	Home: the app is about cinema discovery plus audience-driven programming.
•	Screening detail: buying a confirmed ticket is easy and familiar.
•	Voting screens: users can directly influence what gets shown; this is the key differentiator.
•	Private booking: cinemas can also be booked for birthdays, clubs, team events, and special screenings.
•	Dashboard: cinemas gain operational value, not just another listing tool.
9. UX rules for this prototype
•	Keep every screen focused on one main action.
•	Do not overload forms or filters.
•	Use visible progress indicators for voting deadlines and ticket thresholds.
•	Always explain state changes in plain language.
•	Keep labels explicit and obvious.
•	Prototype links should guide the judges naturally from one success state to the next.
10. Visual direction
•	Tone: cinematic, premium, modern, and clear.
•	Theme: dark UI with warm amber or orange accent color.
•	Typography: clean sans-serif with strong hierarchy, high contrast, and generous spacing.
•	Style cues: large poster imagery, rounded cards, subtle glow, soft shadows, clear progress bars.
•	Do not make it look like a streaming app clone; it should feel like a cinema product with community energy.
11. Suggested component system
•	Movie cards with poster, title, genre and year, location, and state badge.
•	Campaign cards with countdown, vote count, current leader, and progress strip.
•	Primary CTA button in accent color.
•	Secondary ghost button for save or share.
•	Dark top navigation with search and location chip.
•	Analytics cards with simple numbers, trend arrows, and one compact chart per section.
12. Content writing guidance
•	Use short, direct microcopy.
•	Examples: Vote to shape the program; Reserve to make it happen; Only charged if confirmed; Pending cinema approval.
•	Avoid lorem ipsum in key screens; use realistic content so the concept is instantly understandable.
•	Film choices should reflect the target audience: classics, cult films, genre favorites, and indie titles.
13. Acceptable simplifications
•	Use fake but realistic data.
•	No need for real payment flow details.
•	Seat selection can be simplified to ticket quantity.
•	Booking price can be shown as an estimate.
•	Dashboard charts can be illustrative rather than fully detailed.
•	Admin approval can be a single decision screen.
14. Suggested example data
•	Nearby cinemas: Kino Europa, Student Film Hall, ArtHouse Zagreb, City Screen.
•	Example voting films: Mulholland Drive, Oldboy, Before Sunrise, Spirited Away, The Thing.
•	Example status metrics: 72 votes, 31 of 50 tickets reserved, 2 days left, 78 percent likely to confirm.
•	Private booking examples: Birthday screening, Team event, Student club night, Indie filmmaker showcase.
15. Instructions for AI prototype generation
•	Generate a responsive web-app prototype, desktop first.
•	Prioritize layout clarity and clickable flow over full system completeness.
•	Use a reusable component set across all 12 screens.
•	Maintain consistent spacing, state badges, buttons, and card patterns.
•	Ensure the first-time user can understand the full product by clicking through without external explanation.
16. Suggested output order
•	First generate the 12 main screens as high-fidelity frames.
•	Then connect clickable hotspots for the four core flows.
•	Then polish copy, spacing, consistency, and visual hierarchy manually in Figma.
•	Final QA check: can a judge understand the value proposition in under 2 minutes?
17. AI prompt starter
•	Design a responsive dark-mode web-app prototype for a cinema platform called Kinora. The core feature is cinema on demand: cinemas publish available slots and candidate films, users vote on what should screen, then buy tickets once the winning film enters a threshold-based reservation phase. The first-time user flow must start with nearby screenings and active campaigns. Include a compact private booking flow for reserving a cinema for birthdays or special events, and a lightweight cinema admin dashboard with campaign analytics and booking approvals. Keep the prototype simple, intuitive, cinematic, self-explanatory, and polished for judging.


