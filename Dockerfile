# Build frontend and prepare backend dependencies
FROM node:18 AS builder
WORKDIR /app

# Backend dependencies
COPY backend/package*.json backend/
RUN cd backend && npm install

# Frontend dependencies and build
COPY frontend/package*.json frontend/
RUN cd frontend && npm install
COPY frontend frontend
RUN cd frontend && npm run build

# Copy backend source
COPY backend backend

# Final runtime image
FROM node:18
WORKDIR /app

# Copy backend dependencies and source
COPY --from=builder /app/backend/node_modules backend/node_modules
COPY backend backend

# Copy frontend build to be servido pelo backend
COPY --from=builder /app/frontend/build frontend/build

ENV PORT=4000
EXPOSE 4000

WORKDIR /app/backend
CMD ["node", "index.js"]
