import json
import gzip

from abc import ABC, abstractmethod
from base64 import b64encode

from shortuuid import uuid
from IPython.core.display import display, HTML


class Base(ABC):
    @abstractmethod
    def _send(self, array):
        pass

    def _push(self, type, data, props):
        data['type'] = type
        if props:
            data['props'] = props
        line = f'{json.dumps(data)}\n'
        self._send(line.encode())

    def _push_str(self, type, data, props):
        for key, value in data.items():
            if not isinstance(value, str):
                raise TypeError(f'{key} must be a string')
        self._push(type, data, props)

    def _push_int(self, type, data, props):
        for key, value in data.items():
            if not isinstance(value, int):
                raise TypeError(f'{key} must be an integer')
            if value < 0:
                raise TypeError(f'{key} must be non-negative')
        self._push(type, data, props)

    def _validate(self, props, key):
        if key in props and not isinstance(props[key], (int, float)):
            raise TypeError(f'{key} must be an integer or a float')

    def send_settings(self, **kwargs):
        self._push('settings', {}, kwargs)

    def send_vertex(self, id, **kwargs):
        if kwargs is not None:
            self._validate(kwargs, 'x')
            self._validate(kwargs, 'y')
        self._push_str('vertex', {'id': id}, kwargs)

    def send_edge(self, source, target, **kwargs):
        self._push_str('edge', {'source': source, 'target': target}, kwargs)

    def send_frame(self, duration, **kwargs):
        self._push_int('frame', {'duration': duration}, kwargs)


class File(Base):
    def _send(self, array):
        self.file.write(array)

    def __init__(self, path):
        self.file = gzip.open(path, 'wb')

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.file.close()


class Render(Base):
    def _send(self, array):
        run(f"netpixi.send({{}}, '{self.uid}', '{b64encode(array).decode()}');")

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
    file = File(path)
    file.send_settings(**kwargs)
    return file


def open_animation(path):
    return File(path)


def render(path, horizontal=16, vertical=9, normalize=True, infinite=False, broker=False):
    if not isinstance(horizontal, int) or not isinstance(vertical, int):
        raise TypeError('aspect dimensions must be integers')
    if horizontal <= 0 or vertical <= 0:
        raise ValueError('aspect dimensions must be positive')
    if not isinstance(normalize, bool):
        raise TypeError('normalize must be a boolean')
    if not isinstance(infinite, bool):
        raise TypeError('infinite must be a boolean')
    if not isinstance(broker, bool):
        raise TypeError('broker must be a boolean')
    normalizeJS = str(normalize).lower()
    infiniteJS = str(infinite).lower()
    brokerJS = str(broker).lower()
    uid = run(f"netpixi.render({{}}, '{path}', {horizontal}, {vertical}, {normalizeJS}, {infiniteJS}, {brokerJS});")
    return Render(uid)


display(HTML(f'''
    <script src="/files/netpixi.min.js"></script>
'''))
