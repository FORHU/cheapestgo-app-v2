# CheapestGo Domain Glossary

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
