FROM node:22.17.0-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
	COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
	PNPM_HOME=/pnpm \
	PNPM_STORE_DIR=/pnpm/store \
	PATH=/pnpm:$PATH

RUN apt-get update && apt-get install -y --no-install-recommends \
	bash \
	ca-certificates \
	git \
	g++ \
	make \
	python3 \
	tini \
	&& rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /workspace

COPY scripts/dev-source-docker/*.sh /usr/local/bin/

RUN chmod +x /usr/local/bin/*.sh && \
	mkdir -p /pnpm/store /home/node/.n8n && \
	chown -R node:node /pnpm /home/node /workspace

USER node

ENTRYPOINT ["tini", "--", "container-entrypoint.sh"]
CMD ["start-backend.sh"]
