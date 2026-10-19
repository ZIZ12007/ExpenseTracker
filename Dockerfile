# ---------- Frontend build ----------
FROM node:22-alpine AS frontend
WORKDIR /app
COPY frontend/expense-tracker/package.json frontend/expense-tracker/package-lock.json ./frontend/expense-tracker/
RUN cd frontend/expense-tracker && npm ci --include=dev
COPY frontend ./frontend
RUN cd frontend/expense-tracker && npm run build

# ---------- Runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8000
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev
COPY backend ./backend
COPY --from=frontend /app/frontend/expense-tracker/dist ./frontend/expense-tracker/dist
EXPOSE 8000
CMD ["node", "backend/server.js"]
