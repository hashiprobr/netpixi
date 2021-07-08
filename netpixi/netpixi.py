import json
import gzip

from abc import ABC, abstractmethod
from base64 import b64encode

from shortuuid import uuid
from IPython.core.display import display, HTML


class Base(ABC):
    @abstractmethod
    def _send(self, data):
        pass

    def _push(self, type, data, props):
        for key, value in data.items():
            if not isinstance(value, str):
                raise TypeError(f'{key} must be a string')
        data['type'] = type
        if props:
            data['props'] = props
        line = f'{json.dumps(data)}\n'
        self._send(line.encode())

    def _validate(self, props, key):
        if key in props and not isinstance(props[key], (int, float)):
            raise TypeError(f'{key} must be an integer or a float')

    def send_settings(self, **kwargs):
        self._push('settings', {}, kwargs)

    def send_vertex(self, id, **kwargs):
        if kwargs is not None:
            self._validate(kwargs, 'x')
            self._validate(kwargs, 'y')
        self._push('vertex', {'id': id}, kwargs)

    def send_edge(self, source, target, **kwargs):
        self._push('edge', {'source': source, 'target': target}, kwargs)


class File(Base):
    def _send(self, bytes):
        self.file.write(bytes)

    def __init__(self, path, **kwargs):
        self.file = gzip.open(path, 'wb')
        self.send_settings(**kwargs)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.file.close()


class Render(Base):
    def _send(self, bytes):
        run(f"netpixi.send({{}}, '{self.uid}', '{b64encode(bytes).decode()}');")

    def __init__(self, uid):
        self.uid = uid


def run(script):
    uid = uuid()
    display(HTML(f'''
        <div id="{uid}"></div>
        <script>{script.format(f"'{uid}'")}</script>
    '''))
    return uid


def open(path, **kwargs):
    return File(path, **kwargs)


def render(path, horizontal=16, vertical=9, normalize=True, broker=False):
    if not isinstance(horizontal, int) or not isinstance(vertical, int):
        raise TypeError('ratio dimensions must be integers')
    if horizontal <= 0 or vertical <= 0:
        raise ValueError('ratio dimensions must be positive')
    if not isinstance(normalize, bool):
        raise TypeError('normalize must be a boolean')
    if not isinstance(broker, bool):
        raise TypeError('broker must be a boolean')
    normalizeJS = str(normalize).lower()
    brokerJS = str(broker).lower()
    uid = run(f"netpixi.render('{path}', {horizontal}, {vertical}, {normalizeJS}, {brokerJS}, {{}});")
    return Render(uid)


display(HTML(f'''
    <script src="/files/netpixi.min.js"></script>
'''))
