FROM python:3.11-slim-bookworm
ENV PYTHONUNBUFFERED=1
RUN apt-get update &&\
    apt-get -y upgrade &&\
    apt-get -y install nodejs &&\
    pip install --root-user-action ignore --upgrade pip
COPY requirements.txt /
RUN pip install --root-user-action ignore -r /requirements.txt &&\
    jupyter labextension disable "@jupyterlab/apputils-extension:announcements" &&\
    rm -f /requirements.txt
COPY .hidden /home/jupyterlab/.hidden
WORKDIR /home/jupyterlab
ENV PYTHONPATH=${PYTHONPATH}:/home/jupyterlab/.hidden
ENV PYDEVD_DISABLE_FILE_VALIDATION=1
ENTRYPOINT jupyter-lab --allow-root --no-browser --ip 0.0.0.0 --IdentityProvider.token= --ServerApp.extra_static_paths /home/jupyterlab
