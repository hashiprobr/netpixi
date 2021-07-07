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
        if props is not None and not isinstance(props, dict):
            raise TypeError('props must be None or a dictionary')
        data['type'] = type
        if props is not None:
            data['props'] = props
        line = f'{json.dumps(data)}\n'
        self._send(line.encode())

    def _validate(self, props, key):
        if key in props and not isinstance(props[key], (int, float)):
            raise TypeError(f'{key} must be an integer or a float')

    def write_settings(self, props=None):
        self._push('settings', {}, props)

    def write_vertex(self, id, props=None):
        if props is not None:
            self._validate(props, 'x')
            self._validate(props, 'y')
        self._push('vertex', {'id': id}, props)

    def write_edge(self, source, target, props=None):
        self._push('edge', {'source': source, 'target': target}, props)


class File(Base):
    def _send(self, bytes):
        self.file.write(bytes)

    def __init__(self, path, props=None):
        self.file = gzip.open(path, 'wb')
        self.write_settings(props)

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


def open(path, props=None):
    return File(path, props)


def render(path, horizontal=16, vertical=9, normalize=False, broker=False):
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
