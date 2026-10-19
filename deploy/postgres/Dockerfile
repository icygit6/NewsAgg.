# Official PostgreSQL 18 (matches the Neon server version) plus pgvector,
# installed from the PGDG apt repository that the official image already trusts.
FROM mirror.gcr.io/library/postgres:18
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-18-pgvector \
 && rm -rf /var/lib/apt/lists/*
