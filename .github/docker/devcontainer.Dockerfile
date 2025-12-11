ARG BASE_DEVCONTAINER_IMAGE
FROM ${BASE_DEVCONTAINER_IMAGE:-ghcr.io/microsoft/caira-prebuilt-devcontainer-base:latest}
LABEL devcontainer.metadata="[]"
HEALTHCHECK NONE
USER root

# Fake environment for vscode user
ENV HOME=/home/vscode
ENV USER=vscode
ENV XDG_CONFIG_HOME=/home/vscode/.config
ENV XDG_CACHE_HOME=/home/vscode/.cache
ENV XDG_DATA_HOME=/home/vscode/.local/share
ENV PATH=/usr/local/python/current/bin:/usr/local/share/nvm/versions/node/v24.12.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin:/home/vscode/.local/bin:/usr/local/py-utils/bin:/home/vscode/.local/bin:/usr/local/py-utils/bin:/usr/local/jupyter:/usr/local/go/bin:/go/bin

# Set the same PATH for future vscode sessions
RUN echo 'export PATH=/usr/local/python/current/bin:/usr/local/share/nvm/versions/node/v24.12.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin:/home/vscode/.local/bin:/usr/local/py-utils/bin:/home/vscode/.local/bin:/usr/local/py-utils/bin:/usr/local/jupyter:/usr/local/go/bin:/go/bin' >> /home/vscode/.profile

# Add task files
RUN mkdir -p /home/vscode/task
COPY ./Taskfile.yml /home/vscode/task
COPY ./.taskfiles /home/vscode/task/.taskfiles
COPY ./mkdocs.yml /home/vscode/task

WORKDIR /home/vscode/task

RUN git init . && \
  git config user.email "devcontainer@localhost" && \
  git config user.name "devcontainer" && \
  git add . && \
  git commit -m "Temp commit"

RUN task tools

RUN rm -rf /home/vscode/task

# Ensure vscode user owns its home directory
RUN chown -R vscode:vscode /home/vscode

WORKDIR /home/vscode

USER vscode
