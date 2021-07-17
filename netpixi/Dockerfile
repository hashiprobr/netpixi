FROM python:3.7-buster
ENV PYTHONUNBUFFERED=1
RUN apt-get update &&\
    apt-get -y upgrade
ENV PYTHONPATH=${PYTHONPATH}:/usr/lib/python3/dist-packages
RUN echo "deb https://downloads.skewed.de/apt buster main" >> /etc/apt/sources.list &&\
    apt-key adv --keyserver keys.openpgp.org --recv-key 612DEFB798507F25 &&\
    apt-get update &&\
    apt-get -y install python3-graph-tool
RUN /usr/local/bin/python -m pip install --upgrade pip
COPY requirements.txt /home/jupyter/
RUN pip install -r /home/jupyter/requirements.txt
ENV JUPYTER_CONFIG_DIR=/home/jupyter
COPY jupyter_notebook_config.py netpixi.min.js netpixi.min.map /home/jupyter/
ENV PYTHONPATH=${PYTHONPATH}:/home/jupyter
COPY netpixi /home/jupyter/netpixi
WORKDIR /home/jupyter
ENTRYPOINT jupyter notebook --allow-root --ip 0.0.0.0
