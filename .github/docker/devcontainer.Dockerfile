ARG BASE_DEVCONTAINER_IMAGE
FROM ${BASE_DEVCONTAINER_IMAGE}

USER root

RUN sudo echo "test"
RUN chown -R vscode:vscode /home/vscode/.local

#USER vscode
WORKDIR /home/vscode

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

#USER root
RUN chown -R vscode:vscode /home/vscode
#RUN rm -rf /home/vscode/task

USER vscode
