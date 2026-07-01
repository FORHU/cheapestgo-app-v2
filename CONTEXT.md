# CheapestGo Domain Glossary

## cheapest-go-app (V1)
The original monolithic Next.js frontend. Source of truth for all UI, styling, and feature decisions. Uses Tailwind v4, next-intl (en/ko/ja/cn), Lucia auth, and a rich landing page. V2 is being made a pixel-perfect clone of this.

## cheapestgo-app-v2 (V2)
The refactored frontend using a feature-based folder structure (`src/features/`, `src/shared/`). Currently being migrated to be a full visual and feature clone of V1, while preserving V2's cleaner architecture. Connects to `cheapestgo-api-v2` (separate backend).

## UI Migration (V1 → V2)
The process of making V2 look and work identically to V1. Scope: Tailwind v4, next-intl i18n, all landing sections, all providers (Auth, PWA, Theme, Exchange Rate), MobileBottomNav, GlobalSparkle, and every page. V2-unique AI features (ChatWonder, Voice Layer) are deferred in favor of Phase 1 parity first.

## ChatWonder AI
Third-party AI chat engine provided by **forhu.ai**. Powers the conversational interface in Phase 2. Exposes a WebSocket endpoint for real-time streaming (`wss://chat-dev.forhu.ai/chat-stream`) and a REST API (`https://chat-dev.forhu.ai`). The frontend connects directly via WebSocket; the backend also calls it via REST for server-side orchestration. Not to be confused with an in-house model — CheapestGo does not train or fine-tune this model.

## Generative UI
The hybrid interface pattern described in the product roadmap: AI understands natural-language user intent and responds with structured, interactive UI components (itinerary cards, bookable flight/hotel widgets, maps) rather than plain text. Distinct from a traditional chatbot. The FE is responsible for rendering these components; the AI (ChatWonder) returns structured data that drives the component selection.

## Phase 1 — Lowest-Fare Engine
The current build target: a global flight and hotel search/booking platform competitive with Skyscanner. Establishes the user base and collects behavioral data for Phase 2 AI training. Revenue via booking commissions.

## Phase 2 — AI Travel Agent
Integration of ChatWonder AI into the travel booking flow. Features: natural language search, long-term user memory (travel preferences, loyalty status, calendar), proactive suggestions, Generative UI output, and voice input/output (AWS voice services). Revenue via ancillary sales (insurance, tours) and subscriptions.

## Phase 3 — AI Commerce Super-Platform
Expansion from travel into e-commerce using travel intent as a purchase signal. Agentic commerce where the AI proactively suggests products relevant to an upcoming trip. Uses MCP, Universal Commerce Protocol, and Agent Payment Protocol for cross-platform agent interoperability.

## Chat Session Context
The set of user parameters collected before a ChatWonder chat session begins. Passed as initial context to ChatWonder to personalize the conversation. Fields: **travel date(s)**, **destination/location**, **traveler gender**, **traveler age**, **party size** (number of people). This is not fetched from the BE at runtime — it is collected from the user via an intake form on the FE before the WebSocket connection opens.

## Voice Layer
AWS services (region: ap-southeast-1) used for voice input and output in the chat interface. Likely Amazon Transcribe (speech-to-text) and Amazon Polly (text-to-speech). Distinct from ChatWonder AI, which handles text reasoning.
