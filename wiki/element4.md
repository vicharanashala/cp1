# FAQ Knowledge Base & AI Chatbot

**Wiki page 4 — Scope:** Semantic FAQ search, category accordions, promote-Q&A-to-FAQ, the tiered grounded chatbot (FAQ → resolved queries → fallback), embeddings/cosine similarity, the swappable AI mock/live boundary.

**Primary sources:** `server/services/faqService.js`, `server/services/chatbotService.js`, `server/services/vectorService.js`, `server/config/ai.js`, `client/src/pages/Faq.jsx`, `client/src/components/Chatbot.jsx`.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Data Model — FaqEntry](#2-data-model--faqentry)
3. [Embeddings and Cosine Similarity](#3-embeddings-and-cosine-similarity)
4. [FAQ Service](#4-faq-service)
   - 4.1 [Listing FAQs — Category Grouping](#41-listing-faqs--category-grouping)
   - 4.2 [Hybrid Semantic Search](#42-hybrid-semantic-search)
   - 4.3 [Creating FAQ Entries](#43-creating-faq-entries)
   - 4.4 [Updating and Soft-Deleting Entries](#44-updating-and-soft-deleting-entries)
   - 4.5 [Promoting a Resolved Q&A to FAQ](#45-promoting-a-resolved-qa-to-faq)
5. [FAQ Routes and Access Control](#5-faq-routes-and-access-control)
6. [FAQ Page — Frontend](#6-faq-page--frontend)
   - 6.1 [Category Accordions](#61-category-accordions)
   - 6.2 [Live Semantic Search](#62-live-semantic-search)
   - 6.3 [Consent-Gated Forum Fallback](#63-consent-gated-forum-fallback)
7. [Chatbot Service — Tiered Grounded RAG Pipeline](#7-chatbot-service--tiered-grounded-rag-pipeline)
   - 7.1 [Tier 1 — Curated FAQ Answer](#71-tier-1--curated-faq-answer)
   - 7.2 [Tier 2 — Consent and Resolved Community Q&A](#72-tier-2--consent-and-resolved-community-qa)
   - 7.3 [Tier 3 — Graceful Fallback](#73-tier-3--graceful-fallback)
   - 7.4 [Session Management](#74-session-management)
   - 7.5 [Prompt Construction and Grounded Composition](#75-prompt-construction-and-grounded-composition)
8. [Chatbot Routes and Rate Limiting](#8-chatbot-routes-and-rate-limiting)
9. [Chatbot Component — Frontend (Chatbot.jsx)](#9-chatbot-component--frontend-chatbotjsx)
10. [The AI Module — Swappable Mock/Live Boundary](#10-the-ai-module--swappable-mocklive-boundary)
    - 10.1 [Mock Mode](#101-mock-mode)
    - 10.2 [Live Mode — Gemini via @google/genai](#102-live-mode--gemini-via-googlegenai)
    - 10.3 [Request Queue and Exponential Backoff](#103-request-queue-and-exponential-backoff)
    - 10.4 [Public API Surface](#104-public-api-surface)
11. [Key Thresholds and Constants](#11-key-thresholds-and-constants)
12. [Embedding Refresh Job](#12-embedding-refresh-job)
13. [End-to-End Flow Diagrams](#13-end-to-end-flow-diagrams)
14. [Production Swap Guide](#14-production-swap-guide)

---

## 1. Overview

Finding the right answer should not require users to browse dozens of pages, create duplicate questions, or wait hours for a response.

The FAQ Knowledge Base and AI Chatbot were designed to solve this problem by creating a single intelligent entry point for information discovery across the platform.

Together, they form the first pillar of the system's knowledge-sharing architecture. Their goal is simple: help users find trusted answers as quickly as possible while reducing repetitive questions and improving the overall support experience.

Rather than relying on traditional keyword searches alone, the platform combines curated FAQ content, semantic search, and AI-assisted guidance to understand what users are asking, even when questions are phrased differently.

---

## What Makes This System Different?

Most help systems force users to know the exact keywords needed to find an answer. If the wording is slightly different, relevant information is often missed.

This platform takes a different approach.

### Intelligent Knowledge Discovery

The FAQ system understands the meaning behind a question rather than matching words alone. This allows users to search naturally and still receive relevant results, even when their wording differs from the original FAQ article.

### AI-Assisted Guidance

When users cannot immediately find an answer, the chatbot acts as a guided assistant. Instead of generating information from the internet, it searches trusted knowledge already available within the platform and presents it in a conversational format.

### Community-Powered Learning

Knowledge does not remain limited to administrator-created articles. Valuable solutions discovered through community discussions can later be promoted into official FAQ entries, allowing the knowledge base to grow naturally over time.

### Reliable and Transparent Answers

Every chatbot response is grounded in information that already exists within the platform. Users are shown where answers come from, helping build trust and ensuring that responses remain accurate and verifiable.

---

## The Three Core Components

The FAQ and chatbot ecosystem is built around three interconnected components that work together to deliver fast and reliable answers.

### The FAQ Knowledge Base

This is the platform's central source of curated information.

Administrators create and maintain FAQ articles covering common questions, policies, procedures, and frequently requested guidance. These articles are organized into categories and serve as the first source of truth whenever users search for help.

### The AI Chatbot

The chatbot provides a conversational way to access knowledge.

Instead of manually browsing categories, users can ask questions in natural language. The chatbot searches available information, identifies relevant content, and presents responses in a simple and user-friendly format.

### The AI Intelligence Layer

Behind both the FAQ system and chatbot is a shared intelligence layer responsible for understanding content and comparing similarities between questions.

This layer powers semantic search, chatbot retrieval, duplicate detection, and future AI-driven features across the platform.

By centralizing these capabilities, the system remains consistent, scalable, and easier to maintain.

---

## A Knowledge System That Improves Over Time

One of the most valuable aspects of the platform is its ability to continuously expand its knowledge.

As users ask questions and the community contributes solutions, successful discussions can become part of the official FAQ collection.

This creates a continuous cycle of improvement:

1. Users ask questions.
2. Answers are discovered or contributed.
3. Valuable solutions are preserved.
4. Future users benefit instantly.

Over time, the knowledge base becomes richer, search becomes more effective, and users spend less time searching for information.

The result is a self-improving support ecosystem that combines curated knowledge, community expertise, and AI-powered discovery into a single experience.
## 6. FAQ Experience for Users

Finding answers should feel simple, not overwhelming.

The FAQ experience is designed to help users quickly navigate information without needing technical knowledge or advanced search skills. Instead of presenting a large list of articles, the platform organizes information into structured categories that are easy to browse and understand.

Users can expand categories, explore related topics, and read answers directly within the page without navigating through multiple screens. This creates a smoother experience and helps users find information faster.

---

### Organized by Categories

All FAQ articles are grouped into clearly defined categories, making information easier to browse.

Rather than searching through an unstructured collection of content, users can navigate directly to the topic most relevant to their needs.

---

### Quick Article Discovery

The interface highlights important information while keeping the page clean and uncluttered.

Users can expand individual questions to reveal answers only when needed, reducing information overload and improving readability.

---

### Community-Promoted Knowledge

Some FAQ articles originate from successful community discussions.

When a community answer proves valuable enough to become official knowledge, it can be promoted into the FAQ system and displayed alongside administrator-created content.

This ensures useful community expertise remains accessible long after the original discussion ends.

---

## 7. AI Chatbot Assistant

While the FAQ provides a traditional way to browse information, some users prefer asking questions directly.

The AI Chatbot serves as a conversational guide that helps users discover relevant information without manually searching through categories or articles.

Instead of acting as a general-purpose AI, the chatbot focuses exclusively on knowledge that exists within the platform.

This makes responses more reliable, consistent, and easier to verify.

---

### Guided Question Answering

Users can ask questions in natural language, just as they would when speaking to another person.

The chatbot interprets the request, searches available knowledge sources, and presents the most relevant information in a conversational format.

---

### Knowledge Before Guesswork

The chatbot prioritizes trusted platform content before generating a response.

Rather than inventing answers or relying on information from outside sources, it searches existing knowledge and uses that information as the foundation for every response.

This helps maintain accuracy and trust.

---

### Supporting Self-Service Help

Many users simply want a quick answer without opening multiple pages.

The chatbot reduces friction by providing immediate assistance and directing users toward relevant resources whenever possible.

---

## 8. Chatbot Access and User Interaction

The chatbot is designed to be available whenever users need assistance.

Instead of hiding support features deep within the application, the assistant remains accessible throughout the platform, providing a consistent help experience regardless of where users are located.

---

### Always Within Reach

The chatbot can be opened from anywhere within the application, allowing users to seek help without interrupting their current task.

This creates a more seamless support experience and encourages knowledge discovery throughout the platform.

---

### Conversational User Experience

Interactions are presented in a familiar chat-style interface that feels natural and approachable.

Users can ask follow-up questions, review previous responses, and continue conversations without repeatedly searching for information.

---

### Transparent Sources

Whenever the chatbot provides an answer, users can see where the information originated.

Whether the answer comes from an FAQ article or a community discussion, the source remains visible, helping users understand and trust the information being provided.

---

## 9. Conversation History and Knowledge Continuity

Support conversations often span multiple questions and interactions.

To provide a smoother experience, the platform remembers ongoing conversations and allows users to continue where they left off.

This creates a sense of continuity and prevents users from repeating the same information multiple times.

---

### Remembering Previous Interactions

When users return to the chatbot, previous messages can be restored, allowing them to continue existing discussions rather than starting over.

This makes longer conversations easier to manage and improves overall usability.

---

### Building Context Over Time

By maintaining conversation history, the chatbot can present interactions in a logical sequence.

Users can review earlier answers, revisit recommendations, and understand how previous questions relate to current ones.

---

### A More Personalized Experience

Persistent conversations create a more natural support experience and make the chatbot feel less like a simple search tool and more like an ongoing assistant.

---

## 10. AI Integration and System Intelligence

Behind the FAQ system and chatbot lies a shared intelligence layer that powers search, retrieval, and content understanding across the platform.

Rather than embedding AI functionality throughout the application, all intelligence features are managed through a centralized integration layer.

This design keeps the platform organized, maintainable, and adaptable to future improvements.

---

### One Intelligence Layer for Everything

The same AI infrastructure supports multiple platform features, including FAQ search, chatbot retrieval, duplicate detection, and content recommendations.

Using a shared foundation ensures that all intelligent features behave consistently.

---

### Flexible by Design

Technology evolves quickly, and AI capabilities continue to improve.

By keeping AI functionality isolated within a dedicated layer, the platform can adopt new models, providers, or improvements without requiring major changes to the rest of the system.

---

### Reliable in Any Environment

The platform is designed to operate in both development and production environments.

This allows testing, demonstrations, and development work to continue even when live AI services are unavailable, ensuring the system remains dependable under different conditions.

---

### Building for the Future

The intelligence layer provides a foundation for future AI-powered capabilities.

As the platform grows, new features can build upon the same infrastructure without requiring a complete redesign, helping Curio remain scalable and future-ready.
## 11. Platform Intelligence Settings

Every intelligent platform relies on a set of carefully designed rules that help it make consistent decisions.

Rather than treating every search, chatbot request, or content comparison differently, the platform uses shared intelligence settings that guide how information is organized, ranked, and presented to users.

This ensures that all knowledge-related features work together seamlessly and deliver a consistent experience across the platform.

---

### Consistent Search Standards

When the platform evaluates content, it follows a common set of rules to determine relevance and similarity.

These standards help ensure that users receive accurate search results regardless of whether they are searching the FAQ, interacting with the chatbot, or exploring community discussions.

---

### Preventing Duplicate Knowledge

A growing knowledge base can quickly become cluttered if similar content is allowed to accumulate unchecked.

The platform uses intelligent comparison rules to identify highly similar entries and encourage the creation of a cleaner, more organized knowledge repository.

This helps users find the right information faster while reducing confusion caused by duplicate content.

---

### Shared Intelligence Across Features

Instead of maintaining separate logic for every feature, the platform uses a common intelligence layer.

This allows search, chatbot retrieval, and content management systems to operate using the same understanding of relevance and similarity, creating a more unified user experience.

---

## 12. Keeping Knowledge Fresh

Knowledge is constantly evolving.

Questions change, answers improve, and new information becomes available over time. A knowledge platform must continuously adapt to these changes to remain useful and accurate.

To support this, the platform includes automated processes that help keep search intelligence aligned with the latest content.

---

### Adapting to Content Changes

When important information is updated, the platform refreshes its understanding of that content.

This ensures that future searches and chatbot interactions continue to reflect the most current version of the knowledge base.

Users benefit from more accurate results without needing to know that maintenance is happening behind the scenes.

---

### Reducing Administrative Work

Manually updating search intelligence would be time-consuming and error-prone.

By automating this process, the platform reduces maintenance effort while ensuring that content remains searchable and relevant as the system grows.

---

### Supporting Long-Term Accuracy

As more articles and discussions are added, maintaining accuracy becomes increasingly important.

The refresh process helps preserve the quality of search results over time, ensuring that users continue to receive reliable information even as the knowledge base expands.

---

## 13. How Everything Works Together

The FAQ Knowledge Base and AI Chatbot are designed to function as a connected knowledge ecosystem.

Rather than operating as separate tools, they work together to guide users toward the most relevant and trustworthy information available.

Every interaction follows a simple philosophy: provide official knowledge first, then expand to community knowledge when needed.

---

### Starting with Trusted Knowledge

When a user searches for help, the platform first looks for answers within the curated FAQ collection.

Because these articles are reviewed and maintained, they serve as the most reliable source of information available on the platform.

Whenever a suitable FAQ article exists, users can quickly find what they need without creating a new discussion.

---

### Expanding to Community Discussions

Not every question has an official FAQ article.

When the knowledge base cannot provide a suitable answer, the platform can explore relevant community discussions to uncover additional solutions and experiences.

This allows users to benefit from the collective expertise of the community while still maintaining transparency about where information originates.

---

### Learning from Community Success

One of the platform's most valuable capabilities is its ability to transform successful community solutions into permanent knowledge.

When a discussion produces a particularly useful answer, administrators can promote that solution into the FAQ system.

This allows valuable knowledge to remain accessible long after the original conversation has ended.

---

### A Self-Improving Knowledge Ecosystem

Over time, questions lead to discussions, discussions produce solutions, and solutions become part of the knowledge base.

This continuous cycle helps the platform grow smarter and more useful with every interaction.

As the community contributes new knowledge, future users benefit from faster access to reliable answers.

---

## 14. Designed for the Future

Technology continues to evolve, and successful platforms must be able to evolve alongside it.

The knowledge platform has been designed with flexibility and scalability in mind, ensuring that future improvements can be introduced without disrupting existing functionality.

---

### Flexible AI Integration

Artificial intelligence capabilities are managed through a dedicated integration layer rather than being embedded throughout the application.

This makes it easier to adopt new AI technologies, improve existing capabilities, or switch providers in the future while minimizing the impact on the rest of the system.

---

### Scalable Search Infrastructure

As the knowledge base grows, search requirements naturally become more demanding.

The platform's architecture supports future enhancements that can improve search speed, relevance, and scalability while preserving the familiar experience users already understand.

---

### Supporting Community Growth

As more users join the platform and contribute knowledge, the system can continue expanding without losing structure or usability.

The separation between knowledge management, search intelligence, and chatbot assistance helps ensure that each component can evolve independently while continuing to work together.

---

### Building Long-Term Value

Every FAQ article, community discussion, and chatbot interaction contributes to a growing body of knowledge.

Over time, this creates a richer and more valuable ecosystem that benefits both new and experienced users.

The result is a platform that becomes increasingly useful as its community grows and its knowledge base expands.