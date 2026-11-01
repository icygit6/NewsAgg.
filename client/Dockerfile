# --- STAGE 1: Build the app ---
# Use Node 22 Alpine as the base image
FROM node:22-alpine AS builder

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json (if present) first
COPY package*.json ./

# Install all packages (including the build-time tooling)
# Installing inside the container rebuilds native packages for its Linux environment
RUN npm ci

# Copy the rest of the source code
COPY . .

# Inject API base URL at build time for Vite
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ARG VITE_TURNSTILE_SITE_KEY
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
ARG VITE_SENTRY_DSN
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN

# Build the app (outputs the dist folder)
RUN npm run build

# --- STAGE 2: Nginx server ---
# Use the lightweight Nginx image
FROM nginx:alpine

# Copy the custom Nginx config (routing and compression)
# Note: nginx.conf must exist in the client folder
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built static files (dist) from the builder stage into the Nginx directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Tell Docker this container listens on port 80
EXPOSE 80

# Static config needs no package-manifest lookup or runtime templating.
ENTRYPOINT []
# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
