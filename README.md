# Saarthi

Saarthi is a relational AI companion prototype focused on two connected goals:

- emotional support during life transitions
- consistent progress through small, realistic actions

This repository currently contains a React frontend app scaffold for Phase 1 development.
The long-term system direction is MERN + Python AI service.

## Current Prototype

The current frontend demonstrates:

- empathetic, emotion-aware response tone
- trust score phases (Listening, Momentum, Accountability)
- reconnection prompts toward real people
- one tiny action suggestion per response

## Tech Stack (Current)

- React
- React Router
- Vite

## Planned Architecture

- Frontend: React
- Backend API: Node.js + Express (MERN)
- AI Service: Python (FastAPI)
- Database: MongoDB

## Project Structure

```text
Saarthi/
  frontend/
    src/
    package.json
  README.md
  LICENSE
  .gitignore
```

## Run Locally

Frontend:

1. Open the `frontend` directory in terminal.
2. Install dependencies: `npm install`
3. Run dev server: `npm run dev`

Note: If `npm` is not available on your machine, install Node.js first.

## Next Milestones

1. Move frontend to React app structure.
2. Add Express API for chat endpoints.
3. Add Python AI service and structured response contract.
4. Persist sessions and trust history in MongoDB.

## Contributing

Pull requests are welcome. For large changes, open an issue first to discuss scope.

## License

This project is licensed under the MIT License. See the LICENSE file.
