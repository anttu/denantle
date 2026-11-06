FROM mcr.microsoft.com/playwright:v1.64.1-noble

SHELL ["/bin/bash", "-o", "pipefail", "-c"]
ENV NVM_DIR=/opt/nvm
RUN git clone --depth 1 --branch v0.41.0 https://github.com/nvm-sh/nvm.git "$NVM_DIR"
WORKDIR /app
COPY .nvmrc ./
RUN . "$NVM_DIR/nvm.sh" --no-use && nvm install

COPY package.json package-lock.json ./
RUN . "$NVM_DIR/nvm.sh" --no-use && nvm use && npm ci --ignore-scripts --no-audit --no-fund

WORKDIR /app/tests
COPY tests/package.json tests/package-lock.json ./
RUN . "$NVM_DIR/nvm.sh" --no-use && nvm use && npm ci --ignore-scripts --no-audit --no-fund
COPY . /app

CMD ["bash", "-c", ". \"$NVM_DIR/nvm.sh\" --no-use && nvm use && cd /app && npm run typecheck && npm run build && cd /app/tests && exec npm test"]
