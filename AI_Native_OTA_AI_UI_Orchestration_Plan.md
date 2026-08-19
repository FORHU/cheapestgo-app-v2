# AI-Native OTA — AI-Driven UI Orchestration Plan

## 1. Objective

Build an AI-native hotel + flight OTA where AI does not simply act as a chatbot.

The AI layer should:

- Understand natural-language travel intent.
- Search and reason over normalized hotel and flight inventory.
- Recommend and rank products.
- Explain recommendations.
- Modify search state.
- Dynamically compose the UI using a controlled set of React components.
- Optimize complete trips instead of individual products.
- Assist before, during, and after booking.

### Core principle

> AI decides what is useful to show and what action should happen; the backend remains the source of truth; React owns the actual UI.

---

# 2. Current Architecture Assumption

## Frontend

- React
- Next.js
- TypeScript
- Existing OTA UI/components
- Map UI
- Hotel and flight search interfaces

## Backend

- Separate backend
- REST APIs
- Hotel services
- Flight services
- Booking services
- Payment services
- Supplier integrations

Existing supplier abstraction should remain intact.

### Hotel suppliers

- RateHawk
- LiteAPI
- TravelgateX
- ONDA

### Flight suppliers

- Duffel
- Mystifly
- Future providers

---

# 3. Target Architecture

```text
                         ┌───────────────────────┐
                         │       Next.js FE      │
                         │                       │
                         │ Search UI             │
                         │ AI UI                 │
                         │ Hotel UI              │
                         │ Flight UI             │
                         │ Map UI                │
                         │ Booking UI            │
                         └───────────┬───────────┘
                                     │
                              REST / SSE
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │        Backend API              │
                    │                                │
                    │ Auth                           │
                    │ Hotels                         │
                    │ Flights                        │
                    │ Bookings                       │
                    │ Payments                       │
                    │ Users                          │
                    │                                │
                    │ ┌────────────────────────────┐ │
                    │ │   AI ORCHESTRATION LAYER   │ │
                    │ │                            │ │
                    │ │ Intent extraction          │ │
                    │ │ Tool calling               │ │
                    │ │ Recommendation             │ │
                    │ │ UI orchestration           │ │
                    │ │ Personalization            │ │
                    │ └─────────────┬──────────────┘ │
                    └───────────────┼────────────────┘
                                    │
                    ┌───────────────┼────────────────┐
                    ▼               ▼                ▼
              Hotel Services   Flight Services   Booking Services
                    │               │                │
                    ▼               ▼                ▼
               Suppliers         Suppliers         Stripe
```

---

# 4. Core Architectural Principle

AI must NOT directly control external suppliers.

Do not build:

```text
LLM → RateHawk
LLM → TravelgateX
LLM → Duffel
LLM → Stripe
LLM → Database
```

Build:

```text
LLM
 ↓
AI Tool Layer
 ↓
Existing Backend Services
 ↓
Supplier APIs
```

The backend remains responsible for:

- Availability
- Pricing
- Hotel data
- Flight data
- Cancellation policies
- Booking
- Payment
- Authentication
- Supplier communication

AI is responsible for:

- Understanding
- Reasoning
- Recommendation
- Ranking interpretation
- UI orchestration
- Personalization
- Trip planning

---

# 5. Backend AI Module

Recommended backend structure:

```text
backend/
└── src/
    ├── modules/
    │
    ├── hotels/
    │   ├── hotel.controller.ts
    │   ├── hotel.service.ts
    │   ├── hotel.repository.ts
    │   └── hotel.routes.ts
    │
    ├── flights/
    │   ├── flight.controller.ts
    │   ├── flight.service.ts
    │   ├── flight.repository.ts
    │   └── flight.routes.ts
    │
    ├── bookings/
    ├── payments/
    ├── users/
    │
    └── ai/
        ├── ai.controller.ts
        ├── ai.routes.ts
        ├── ai.service.ts
        │
        ├── agents/
        │   └── travel.agent.ts
        │
        ├── tools/
        │   ├── search-hotels.tool.ts
        │   ├── search-flights.tool.ts
        │   ├── hotel-details.tool.ts
        │   ├── hotel-reviews.tool.ts
        │   ├── compare-hotels.tool.ts
        │   ├── compare-flights.tool.ts
        │   ├── trip-budget.tool.ts
        │   └── alternative-search.tool.ts
        │
        ├── prompts/
        │   └── travel.prompt.ts
        │
        ├── schemas/
        │   ├── ai-response.schema.ts
        │   ├── search.schema.ts
        │   └── ui.schema.ts
        │
        └── types/
            └── ai.types.ts
```

Start with one Travel Agent rather than multiple specialized agents.

---

# 6. AI Tool Layer

The AI should have access to controlled tools.

## Initial tools

```text
search_hotels
search_flights
get_hotel_details
get_hotel_reviews
compare_hotels
compare_flights
find_alternative_hotel
find_alternative_flight
calculate_trip_budget
get_trip
get_booking_details
```

## Future tools

```text
build_itinerary
find_activities
find_restaurants
check_booking_status
find_rebooking_options
analyze_price
optimize_trip
```

The AI should never invent tool results.

---

# 7. Normalized Inventory Layer

AI should work against normalized OTA data rather than supplier-specific formats.

Example hotel:

```ts
interface NormalizedHotel {
  id: string;
  supplier: string;

  name: string;

  latitude: number;
  longitude: number;

  starRating: number;
  rating: number;
  reviewCount: number;

  amenities: string[];

  location: {
    city: string;
    neighborhood?: string;
    distanceToCenter?: number;
    distanceToMetro?: number;
  };

  rooms: NormalizedRoom[];
}
```

Example flight:

```ts
interface NormalizedFlight {
  id: string;
  supplier: string;

  segments: FlightSegment[];

  totalPrice: number;
  currency: string;

  baggage: BaggageAllowance[];

  fareRules: FareRule[];

  cancellationPolicy?: CancellationPolicy;
}
```

This makes AI supplier-agnostic.

---

# 8. AI Natural-Language Search

User input:

> I want to go to Seoul with my girlfriend for 5 days in October, near nightlife, in a nice hotel, under ₱70k total.

AI extracts:

```json
{
  "destination": "Seoul",
  "tripType": "couple",
  "duration": 5,
  "month": "October",
  "hotelPreference": "nice",
  "locationPreference": "nightlife",
  "budget": 70000,
  "currency": "PHP"
}
```

If information is missing, AI should ask for only the missing information.

Example:

> When would you like to travel?

The frontend can render a date picker instead of a text-only response.

---

# 9. AI-Driven UI Orchestration

This is the central feature.

AI should NOT generate arbitrary HTML or React code.

AI should return structured UI instructions.

Example:

```json
{
  "message": "I found several strong hotel options around Hongdae.",

  "state": {
    "destination": "Seoul",
    "area": "Hongdae",
    "sort": "ai_match"
  },

  "ui": [
    {
      "type": "hotel_results"
    },
    {
      "type": "map"
    },
    {
      "type": "budget"
    },
    {
      "type": "recommendation"
    }
  ]
}
```

React owns the actual components.

---

# 10. Frontend Component Registry

Create a controlled AI UI component registry:

```ts
const AI_COMPONENTS = {
  hotel_results: HotelResults,
  flight_results: FlightResults,
  hotel_comparison: HotelComparison,
  flight_comparison: FlightComparison,
  map: TravelMap,
  budget: BudgetCard,
  itinerary: Itinerary,
  recommendation: RecommendationCard,
  question: QuestionCard,
  alert: AlertCard
};
```

Renderer:

```tsx
function AIUIRenderer({ block }) {
  switch (block.type) {
    case "hotel_results":
      return <HotelResults {...block} />;

    case "flight_results":
      return <FlightResults {...block} />;

    case "hotel_comparison":
      return <HotelComparison {...block} />;

    case "budget":
      return <BudgetCard {...block} />;

    case "itinerary":
      return <Itinerary {...block} />;

    case "question":
      return <QuestionCard {...block} />;

    case "alert":
      return <AlertCard {...block} />;

    default:
      return null;
  }
}
```

AI chooses the component type.

React owns implementation and styling.

---

# 11. AI Response Contract

Standardize AI responses into three sections:

```json
{
  "message": "...",

  "state": {},

  "ui": []
}
```

## message

Human-readable explanation.

## state

Changes to the current OTA/search state.

## ui

Structured UI blocks.

Example:

```json
{
  "message": "I found cheaper hotels closer to Hongdae.",

  "state": {
    "destination": "Seoul",
    "area": "Hongdae",
    "sort": "ai_match"
  },

  "ui": [
    {
      "type": "hotel_results",
      "title": "Best hotels for your trip"
    },
    {
      "type": "map"
    }
  ]
}
```

---

# 12. Search State Patching

The AI should be able to modify the current OTA search state without directly manipulating React.

Example:

```ts
interface SearchState {
  destination: string;
  checkIn: string;
  checkOut: string;

  guests: number;

  priceRange: [number, number];

  stars: number[];

  amenities: string[];

  sort: string;

  view: "list" | "map";
}
```

AI can return:

```json
{
  "searchStatePatch": {
    "destination": "Seoul",
    "priceRange": [0, 8000],
    "amenities": [],
    "sort": "ai_match"
  }
}
```

Frontend applies:

```ts
setSearchState(prev => ({
  ...prev,
  ...searchStatePatch
}));
```

The normal OTA search UI then reacts.

---

# 13. AI Actions

AI responses should support safe frontend actions.

Example:

```json
{
  "message": "Hotel A is a better fit for your preferences.",

  "actions": [
    {
      "type": "select_hotel",
      "hotelId": "hotel_123"
    },
    {
      "type": "compare",
      "hotelIds": [
        "hotel_123",
        "hotel_456"
      ]
    }
  ]
}
```

Frontend renders:

```text
Hotel A is a better fit.

[ Select Hotel ]

[ Compare with Hotel B ]
```

Actions should call existing frontend/backend flows.

---

# 14. Dynamic UI Examples

## User: "I want to go to Seoul."

AI detects missing dates.

Response:

```json
{
  "ui": [
    {
      "type": "question",
      "question": "When would you like to travel?",
      "input": "date_range"
    }
  ]
}
```

React displays the existing date picker.

---

## User: "I care more about location than price."

AI can change the presentation emphasis:

```json
{
  "ui": {
    "layout": "location_first",
    "emphasis": [
      "distance_to_subway",
      "neighborhood",
      "nightlife"
    ]
  }
}
```

React can switch to a map-first hotel layout.

---

## User: "Make it cheaper."

AI returns:

```json
{
  "message": "I found a cheaper option without significantly reducing your trip match.",

  "actions": [
    {
      "type": "replace_hotel",
      "currentHotelId": "hotel_123",
      "recommendedHotelId": "hotel_456"
    }
  ],

  "ui": [
    {
      "type": "savings",
      "currentPrice": 40000,
      "newPrice": 32500,
      "savings": 7500
    }
  ]
}
```

React renders a savings card and a controlled replacement action.

---

# 15. AI Hotel Ranking

Do NOT send hundreds of hotels directly to an LLM.

Use a multi-stage pipeline:

```text
600 hotels
    ↓
Hard filters
    ↓
100 hotels
    ↓
Ranking engine
    ↓
20 hotels
    ↓
AI reasoning
    ↓
5 recommendations
```

Ranking factors can include:

```text
priceScore
locationScore
ratingScore
reviewScore
preferenceScore
amenityScore
cancellationScore
transportScore
```

Eventually this ranking engine can become a dedicated ML/recommendation service.

---

# 16. Trip Match Score

Create a proprietary score:

```text
95% MATCH
```

Possible factors:

| Factor | Weight |
|---|---:|
| User preference | 30% |
| Location | 20% |
| Price | 20% |
| Reviews | 15% |
| Amenities | 10% |
| Cancellation | 5% |

Weights should eventually be configurable and learned from user behavior.

Example hotel:

```text
95% MATCH

✓ Near nightlife
✓ 4-minute walk to subway
✓ Fits budget
✓ High cleanliness score
✓ Free cancellation
```

---

# 17. AI Hotel Review Intelligence

Do not summarize thousands of reviews on every request.

Use an ingestion pipeline:

```text
Hotel Reviews
      ↓
Review Processor
      ↓
AI Analysis
      ↓
hotel_ai_insights
      ↓
Frontend
```

Store structured insights:

```json
{
  "hotelId": "123",

  "positive": [
    "excellent location",
    "clean rooms",
    "friendly staff"
  ],

  "negative": [
    "small bathrooms",
    "street noise"
  ],

  "categories": {
    "location": 9.4,
    "cleanliness": 9.0,
    "service": 8.8,
    "noise": 7.2
  }
}
```

This reduces AI cost and improves latency.

---

# 18. AI Hotel Explanation

Every recommendation should be explainable.

Example:

> I chose this hotel because it is 4 minutes from the subway, has strong cleanliness reviews, is near nightlife, and remains within your budget.

Also support:

> Why not this hotel?

AI should explain ranking differences using actual data.

---

# 19. AI Flight Recommendation

Support natural tradeoffs.

Example:

> I don't mind a 2-hour layover if it saves ₱5,000, but I don't want overnight flights.

AI converts this into:

```json
{
  "maxLayoverMinutes": 120,
  "minimumSavings": 5000,
  "avoidOvernight": true
}
```

The flight ranking engine then applies those preferences.

---

# 20. AI Fare Explanation

Example:

> This fare is ₱2,100 cheaper, but you cannot check a bag and changes cost ₱4,000.

AI should compare:

- Base fare
- Baggage
- Seat
- Cancellation
- Change fees
- Flexibility

Then recommend the fare based on the user's actual needs.

---

# 21. AI Trip Optimizer

Introduce a Trip object:

```ts
interface Trip {
  id: string;
  userId: string;

  destination: string;

  startDate: string;
  endDate: string;

  travelers: number;

  budget: number;
  currency: string;

  flightBookingId?: string;
  hotelBookingId?: string;

  preferences: TripPreferences;
}
```

The optimizer can evaluate:

```text
Flight
+
Hotel
+
Transport
+
Activities
```

Against:

```text
Price
Comfort
Location
Preferences
Cancellation
```

Goal:

> Optimize the complete trip rather than individual products.

---

# 22. AI Budget Optimization

Example:

```text
Total budget: ₱100,000

Flight       ₱28,000
Hotel        ₱35,000
Transport     ₱7,000
Food         ₱15,000
Activities    ₱8,000

Remaining     ₱7,000
```

AI could say:

> Your hotel is consuming more of your budget than necessary. I found three alternatives that save ₱8,000 while maintaining a 90%+ trip match.

---

# 23. AI Bundle Optimization

The AI should eventually search combinations.

Example:

```text
Flight A + Hotel A = ₱57,000
Flight A + Hotel B = ₱53,500
Flight B + Hotel A = ₱55,200
Flight B + Hotel B = ₱51,900
```

AI recommends:

```text
AI OPTIMIZED TRIP

Flight B
+
Hotel B

Total: ₱51,900

Savings: ₱5,100
```

The optimization must use real availability and prices from backend services.

---

# 24. AI Concierge

After booking, the AI becomes a persistent travel assistant.

Potential features:

- Trip itinerary
- Flight reminders
- Hotel check-in reminders
- Airport transfer reminders
- Booking status
- Cancellation deadline
- Disruption alerts
- Rebooking assistance

Example:

> Your flight changed by 47 minutes.

Actions:

```text
[Review options]
[Find alternative]
[Contact support]
```

---

# 25. AI Memory / Personalization

Do not store the entire conversation as permanent memory.

Use preference extraction.

Example:

```text
Conversation
    ↓
Preference extraction
    ↓
Validation
    ↓
User preference
```

Potential preferences:

```text
preferredHotelStars
preferredNeighborhoodType
prefersFreeCancellation
prefersDirectFlights
prefersMorningFlights
prefersCheckedBaggage
prefersMetroAccess
```

Store confidence and timestamps.

Example:

```text
preference = "prefers_metro_access"
confidence = 0.89
source = "booking_behavior"
updatedAt = ...
```

---

# 26. AI Conversation API

Recommended endpoints:

```text
POST /api/ai/conversations
GET  /api/ai/conversations/:id
POST /api/ai/conversations/:id/messages
DELETE /api/ai/conversations/:id
```

Optional specialized endpoints:

```text
POST /api/ai/hotels/recommend
POST /api/ai/flights/recommend
POST /api/ai/trips/optimize
POST /api/ai/itinerary
```

The conversational API should be the primary entry point.

---

# 27. Streaming

Use SSE for AI response streaming initially.

Example:

```text
POST /api/ai/conversations/:id/messages
```

Stream events:

```text
intent_detected
search_started
searching_flights
searching_hotels
ranking_results
ui_update
message_complete
```

Example:

```text
Understanding your trip...
Searching flights...
Searching hotels...
Comparing options...
Found 5 strong matches.
```

WebSockets can remain responsible for real-time application events such as:

- Booking status
- Admin notifications
- Payment status
- Supplier events

---

# 28. Booking Safety

AI must not directly execute payment or irreversible booking actions.

Recommended flow:

```text
AI recommendation
      ↓
User confirmation
      ↓
Review booking
      ↓
Existing booking flow
      ↓
Payment
      ↓
Supplier booking
```

AI can recommend:

> Book Hotel A

But the existing booking system performs:

- Validation
- Price verification
- Availability verification
- Payment
- Supplier booking
- Confirmation

---

# 29. UI/UX Direction

Do not create a separate chatbot-only product.

Use AI as an enhancement to the existing OTA.

### Homepage

```text
Where are you going?

[ Search normally ]

OR

✨ Tell us what kind of trip you want

"I want a 5-day Seoul trip for two under ₱70k..."
```

### Search results

Traditional controls remain available:

```text
Filters
Sort
Map
Hotel cards
```

AI adds:

```text
✨ AI optimized
95% match
Why this hotel?
Ask AI
Make it cheaper
Find something better
```

### Hotel details

Add:

```text
AI Review Summary
AI Match Score
Why we recommend this
Ask about this hotel
Compare with alternatives
```

### Booking page

Add:

```text
AI Booking Check

✓ Free cancellation
✓ Your baggage requirement is covered
✓ Hotel check-in matches your arrival
```

---

# 30. AI Should Adapt Existing UI

Do not rebuild the entire OTA UI.

Use existing components with AI-aware props.

Example:

```tsx
<HotelCard
  hotel={hotel}
  aiMatchScore={96}
  aiReasons={[
    "Near nightlife",
    "Quiet rooms",
    "Near subway"
  ]}
/>
```

This lets the existing design system remain consistent.

---

# 31. AI UI Component Types

Initial registry:

```text
hotel_results
flight_results
hotel_comparison
flight_comparison
hotel_recommendation
flight_recommendation
map
budget
savings
trip_summary
itinerary
question
alert
price_insight
fare_explanation
review_summary
action_card
```

Later:

```text
neighborhood_comparison
activity_results
restaurant_results
booking_guardian
rebooking_options
```

---

# 32. Security Rules

AI must never:

- Execute arbitrary backend functions.
- Access unrestricted database queries.
- Directly access payment credentials.
- Directly modify booking records.
- Invent price or availability.
- Bypass authorization.
- Generate arbitrary executable frontend code.

All AI actions must pass through:

```text
AI
 ↓
Validated Tool Schema
 ↓
Authorization
 ↓
Existing Service
 ↓
Database / Supplier
```

Use Zod or equivalent validation for all AI-generated tool arguments and response structures.

---

# 33. Observability

Track every AI interaction.

Suggested metadata:

```text
conversationId
userId
requestId
model
toolCalls
latency
tokenUsage
estimatedCost
searchResultsCount
recommendedResults
userAction
conversion
```

Important metrics:

```text
AI search → booking conversion
AI recommendation click rate
AI recommendation acceptance rate
AI search completion rate
AI-assisted booking conversion
Average AI response latency
AI cost per booking
Tool error rate
```

---

# 34. Caching

AI should not cause unnecessary supplier calls.

Cache:

- Hotel AI insights
- Review summaries
- Destination intelligence
- Neighborhood information
- Static hotel metadata
- Common search results where appropriate

Do NOT blindly cache:

- Real-time availability
- Final booking price
- Payment state
- Booking confirmation

Those should always be verified by backend services.

---

# 35. Implementation Phases

## Phase 0 — Architecture Preparation

- [ ] Audit current hotel/flight service abstraction.
- [ ] Confirm normalized hotel model.
- [ ] Confirm normalized flight model.
- [ ] Identify reusable search services.
- [ ] Define AI response schemas.
- [ ] Define frontend AI component registry.
- [ ] Define authorization rules.
- [ ] Define logging/observability.

---

## Phase 1 — AI Foundation

- [ ] Create backend `/ai` module.
- [ ] Add AI provider abstraction.
- [ ] Create Travel Agent.
- [ ] Create tool registry.
- [ ] Create Zod schemas.
- [ ] Implement conversation storage.
- [ ] Implement AI conversation endpoint.
- [ ] Implement SSE streaming.
- [ ] Add basic AI chat UI.

Goal:

> User can describe a trip naturally and receive a structured response.

---

## Phase 2 — Natural-Language Search

- [ ] Implement intent extraction.
- [ ] Implement missing-information detection.
- [ ] Implement hotel search tool.
- [ ] Implement flight search tool.
- [ ] Connect normalized inventory.
- [ ] Add search state patching.
- [ ] Add date picker AI interaction.
- [ ] Add guest selector AI interaction.
- [ ] Add budget interpretation.

Goal:

> User can search hotels and flights using natural language.

---

## Phase 3 — AI UI Orchestration

- [ ] Build AI UI component registry.
- [ ] Build AI UI renderer.
- [ ] Define UI block schemas.
- [ ] Implement hotel result blocks.
- [ ] Implement flight result blocks.
- [ ] Implement map blocks.
- [ ] Implement recommendation blocks.
- [ ] Implement question blocks.
- [ ] Implement budget blocks.
- [ ] Implement action blocks.

Goal:

> AI dynamically changes what UI components are displayed.

---

## Phase 4 — AI Ranking

- [ ] Build deterministic ranking engine.
- [ ] Implement price score.
- [ ] Implement location score.
- [ ] Implement review score.
- [ ] Implement preference score.
- [ ] Implement cancellation score.
- [ ] Implement transportation score.
- [ ] Create Trip Match Score.
- [ ] Add recommendation explanations.

Goal:

> AI recommendations are based on structured scoring rather than raw LLM judgment.

---

## Phase 5 — Hotel Intelligence

- [ ] Build review ingestion.
- [ ] Build AI review summarization.
- [ ] Store hotel AI insights.
- [ ] Build hotel review summary UI.
- [ ] Add "Why this hotel?"
- [ ] Add "Why not this hotel?"
- [ ] Add neighborhood intelligence.
- [ ] Add AI hotel comparison.

Goal:

> Users can understand a hotel without reading hundreds of reviews.

---

## Phase 6 — Flight Intelligence

- [ ] Build flight preference extraction.
- [ ] Build flight ranking.
- [ ] Add fare explanation.
- [ ] Add baggage-aware recommendations.
- [ ] Add layover preference handling.
- [ ] Add overnight-flight preference.
- [ ] Add direct-flight preference.
- [ ] Add flight comparison.

Goal:

> AI explains and optimizes flight tradeoffs.

---

## Phase 7 — Trip Optimizer

- [ ] Introduce Trip entity.
- [ ] Connect flight + hotel.
- [ ] Implement total trip budget.
- [ ] Implement bundle optimization.
- [ ] Implement hotel swap.
- [ ] Implement flight swap.
- [ ] Implement savings UI.
- [ ] Add complete-trip match score.

Goal:

> AI optimizes the entire trip instead of individual bookings.

---

## Phase 8 — Personalization

- [ ] Create user travel preference model.
- [ ] Implement preference extraction.
- [ ] Store confidence.
- [ ] Add behavioral signals.
- [ ] Personalize ranking.
- [ ] Personalize UI emphasis.
- [ ] Add returning-user recommendations.

Goal:

> OTA becomes more useful with repeated use.

---

## Phase 9 — AI Concierge

- [ ] Create post-booking AI context.
- [ ] Add trip dashboard.
- [ ] Add itinerary.
- [ ] Add booking reminders.
- [ ] Add cancellation reminders.
- [ ] Add disruption monitoring.
- [ ] Add rebooking recommendations.
- [ ] Add support actions.

Goal:

> AI becomes a travel companion after booking.

---

# 36. MVP Scope

Do NOT build everything initially.

Recommended first MVP:

```text
1. Natural-language travel search
2. AI intent extraction
3. Hotel search tool
4. Flight search tool
5. AI hotel ranking
6. AI flight ranking
7. Trip Match Score
8. AI explanations
9. AI UI renderer
10. Search state patching
11. Hotel recommendation cards
12. Flight recommendation cards
13. AI conversation
14. SSE streaming
```

This is enough to demonstrate the core concept.

---

# 37. Example End-to-End Flow

User:

> I want to visit Seoul for 5 days with my girlfriend. We want nightlife, a nice hotel, and our total budget is ₱70k.

## Step 1 — Next.js

```text
POST /api/ai/conversations/:id/messages
```

## Step 2 — Backend

AI extracts:

```text
Destination: Seoul
Travelers: 2
Trip type: Couple
Duration: 5 days
Preference: Nightlife
Hotel quality: Nice
Budget: ₱70,000
```

## Step 3 — AI requests tools

```text
search_flights()
search_hotels()
```

## Step 4 — Backend services

```text
FlightService
 ↓
Duffel / Mystifly

HotelService
 ↓
RateHawk / LiteAPI / TravelgateX
```

## Step 5 — Normalize results

```text
Flights
Hotels
Prices
Policies
Reviews
Locations
```

## Step 6 — Ranking

```text
600 hotels
 ↓
Hard filters
 ↓
100
 ↓
Ranking
 ↓
20
 ↓
Top 5
```

## Step 7 — AI reasoning

AI explains:

```text
Hotel A = 96% match
Hotel B = 93% match
Hotel C = 90% match
```

## Step 8 — Structured UI response

```json
{
  "message": "I found five strong options around Hongdae.",

  "state": {
    "destination": "Seoul",
    "sort": "ai_match"
  },

  "ui": [
    {
      "type": "trip_summary"
    },
    {
      "type": "flight_results"
    },
    {
      "type": "hotel_results"
    },
    {
      "type": "map"
    },
    {
      "type": "budget"
    }
  ]
}
```

## Step 9 — Next.js renders

```text
┌──────────────────────────────────────────┐
│ 🇰🇷 Your Seoul Trip                      │
│ 5 nights • 2 travelers                   │
│                                          │
│ Budget: ₱70,000                          │
└──────────────────────────────────────────┘

✈️ Recommended Flights

[ Flight A ] [ Flight B ]

🏨 Hotels selected for you

[ Hotel A - 96% ] 
[ Hotel B - 93% ]
[ Hotel C - 90% ]

🗺️ Map

💰 Estimated Trip Cost

₱66,920

[ Optimize ] [ Compare ] [ Continue ]
```

---

# 38. Final Product Vision

The end state should not feel like:

> "An OTA with a chatbot."

It should feel like:

> "An OTA that understands what I want."

Traditional OTA:

```text
Search
 ↓
Filters
 ↓
Sort
 ↓
Compare
 ↓
Book
```

AI-native OTA:

```text
Tell us what you want
 ↓
Understand intent
 ↓
Search
 ↓
Rank
 ↓
Explain
 ↓
Adapt UI
 ↓
Optimize trip
 ↓
Book
 ↓
Monitor trip
```

The strongest differentiator is the combination of:

```text
AI Understanding
        +
Normalized OTA Inventory
        +
Deterministic Ranking
        +
AI Reasoning
        +
Structured UI Orchestration
        +
Trip Optimization
        +
Personalization
```

The AI should therefore be treated as an **orchestration and intelligence layer on top of the existing OTA**, not as a replacement for the existing architecture.
