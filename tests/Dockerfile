FROM mcr.microsoft.com/playwright:v1.64.1-noble

WORKDIR /app/tests
COPY tests/package.json tests/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . /app

CMD ["npm", "test"]
