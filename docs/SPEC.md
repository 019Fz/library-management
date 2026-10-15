# Project: Library Management System
## Description
Develop a web application where users can manage their personal library. Users can add, edit, or delete books, organize them by genre, and track their reading status. An admin user has the authority to manage all books and users.

## Entities
- User: a registered user with basic details like name, email, and password.
- Book: title, author, genre, and reading status (e.g. "reading", "completed"), with the user's ID for association.

## Relationships
- One-to-Many: each user can have multiple books. Books belong to a specific user.

## Main Features
- User registration and login
- Book creation
- Book editing
- Book deletion
- Admin dashboard with privileges to manage all books and users

## Technology
React and Node.js are suggested, but any stack is allowed.

## Bonus Features
- Unit tests and integration tests
- Deploy to a hosting provider
- Use Docker and docker compose

## Additional AI Requirements

### 1. AI Query Agent (REQUIRED)
- Book listing based on the logged-in user or admin.
- An AI-powered assistant lets users (especially the admin) ask natural-language questions about the library's data.
- Example queries:
  - "Who owns the most books?"
  - "Which is the most popular book?"
  - "Show the five most expensive books."
- Technical guidance: use text-to-query translation via a small LLM API (OpenAI, Ollama, local model) OR a rule-based keyword parser.
- Display results in the UI as formatted tables or summaries.

### 2. AI Recommendation Engine (optional bonus)
- Lightweight book recommendations: suggested readings based on history or genre.
- Can be collaborative filtering or AI-generated suggestions.

### 3. AI Summary / Insights Panel (optional bonus)
- A "Library Insights" dashboard.
- Summaries such as "Summarize this user's reading habits".
- Auto-generated insights such as "Fantasy is the most read genre" or "User X tends to read short books".

### 4. Evaluation Criteria for the AI Component
- Functionality: does the AI answer relevant data questions correctly?
- Usability: is the interaction intuitive?
- Creativity: extra AI features (insights, recommendations).
- Technical soundness: clean queries, efficient integration, minimal API misuse.