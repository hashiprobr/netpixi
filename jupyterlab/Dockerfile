FROM python:3.11-slim-bookworm
ENV PYTHONUNBUFFERED=1
RUN apt-get update &&\
    apt-get -y upgrade
RUN /usr/local/bin/python -m pip install --upgrade pip
COPY requirements.txt /home/jupyterlab/.hidden/
RUN pip install -r /home/jupyterlab/.hidden/requirements.txt
RUN jupyter labextension disable "@jupyterlab/apputils-extension:announcements"
COPY .hidden /home/jupyterlab/.hidden
WORKDIR /home/jupyterlab
ENV PYTHONPATH=${PYTHONPATH}:/home/jupyterlab/.hidden
ENV PYDEVD_DISABLE_FILE_VALIDATION=1
ENTRYPOINT jupyter-lab --allow-root --no-browser --ip 0.0.0.0 --IdentityProvider.token= --ContentsManager.allow_hidden=True --ServerApp.extra_static_paths /home/jupyterlab
