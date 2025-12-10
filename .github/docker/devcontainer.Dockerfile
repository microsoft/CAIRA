ARG BASE_DEVCONTAINER_IMAGE
FROM ${BASE_DEVCONTAINER_IMAGE:-caira-devcontainer-base}

USER vscode
WORKDIR /home/vscode

RUN sudo chown -R $(id -un):$(id -gn) $HOME/.local

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

WORKDIR /home/vscode

RUN sudo chown -R $(id -un):$(id -gn) /home/vscode
RUN rm -rf /home/vscode/task
