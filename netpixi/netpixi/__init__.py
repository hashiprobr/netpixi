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

    def _push_empty(self, type, props):
        self._push(type, {}, props)

    def _push_int(self, type, data, props):
        for key, value in data.items():
            if not isinstance(value, int) or value < 0:
                raise TypeError(f'{key} must be a non-negative integer')
        self._push(type, data, props)

    def _push_str(self, type, data, props):
        for key, value in data.items():
            if not isinstance(value, (int, str)):
                raise TypeError(f'{key} must be an integer or a string')
        self._push(type, data, props)

    def _clean_num(self, props, key):
        if key in props and not isinstance(props[key], (int, float)):
            raise TypeError(f'{key} must be an integer or a float')

    def _clean_str(self, props, key):
        if key in props and not isinstance(props[key], str):
            raise TypeError(f'{key} must be a string')

    def _send_settings(self, props):
        self._push_empty('settings', props)

    def _send_vertex(self, id, props):
        self._clean_num(props, 'x')
        self._clean_num(props, 'y')
        self._clean_str(props, 'key')
        self._clean_str(props, 'value')
        self._push_str('vertex', {'id': id}, props)

    def _send_edge(self, source, target, props):
        self._clean_str(props, 'label')
        self._push_str('edge', {'source': source, 'target': target}, props)

    def _send_frame(self, duration, props):
        self._push_int('frame', {'duration': duration}, props)


class BaseFile(Base):
    def _send(self, array):
        self.file.write(array)

    def __init__(self, path):
        self.file = gzip.open(path, 'wb')

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.file.close()


class File(BaseFile):
    def write_vertex(self, id, **kwargs):
        self._send_vertex(id, kwargs)

    def write_edge(self, source, target, **kwargs):
        self._send_edge(source, target, kwargs)


class AnimationFile(BaseFile):
    def write_frame(self, duration, **kwargs):
        self._send_frame(duration, kwargs)


class Proxy(Base):
    def _send(self, array):
        run(f"netpixi.call({{}}, '{self.uid}', '{self.name}', '{b64encode(array).decode()}');")

    def __init__(self, uid, name):
        self.uid = uid
        self.name = name


class GraphDeleter(Proxy):
    def __init__(self, uid):
        super().__init__(uid, 'deleteGraph')


class GraphCopier(Proxy):
    def __init__(self, uid):
        super().__init__(uid, 'copyGraph')


class GraphSetter(Proxy):
    def __init__(self, uid):
        super().__init__(uid, 'setGraph')


class GraphNormalizer(Proxy):
    def __init__(self, uid):
        super().__init__(uid, 'normalizeGraph')


class GraphChanger(Proxy):
    def __init__(self, uid):
        super().__init__(uid, 'changeGraph')


class SelectionChanger(Proxy):
    def __init__(self, uid):
        super().__init__(uid, 'changeSelection')


class Render:
    def __init__(self, uid):
        self.graph_deleter = GraphDeleter(uid)
        self.graph_copier = GraphCopier(uid)
        self.graph_setter = GraphSetter(uid)
        self.graph_normalizer = GraphNormalizer(uid)
        self.graph_changer = GraphChanger(uid)
        self.selection_changer = SelectionChanger(uid)

    def vertex_clear(self, src):
        self.graph_deleter._push_empty('vertex', {'src': src})

    def edge_clear(self, src):
        self.graph_deleter._push_empty('edge', {'src': src})

    def vertex_copy(self, src, dst):
        self.graph_copier._push_empty('vertex', {'src': src, 'dst': dst})

    def edge_copy(self, src, dst):
        self.graph_copier._push_empty('edge', {'src': src, 'dst': dst})

    def vertex_key(self, src):
        self.graph_setter._push_empty('vertex', {'src': src, 'dst': 'key'})

    def vertex_value(self, src):
        self.graph_setter._push_empty('vertex', {'src': src, 'dst': 'value'})

    def edge_label(self, src):
        self.graph_setter._push_empty('edge', {'src': src})

    def vertex_scale(self, src, min, max):
        self.graph_normalizer._push_empty('vertex', {'src': src, 'min': min, 'max': max})

    def edge_scale(self, src, min, max):
        self.graph_normalizer._push_empty('edge', {'src': src, 'min': min, 'max': max})

    def graph(self, **kwargs):
        self.graph_changer._send_settings({'graph': kwargs})

    def vertex_default(self, **kwargs):
        self.graph_changer._send_settings({'vertex': kwargs})

    def edge_default(self, **kwargs):
        self.graph_changer._send_settings({'edge': kwargs})

    def vertex_selection(self, **kwargs):
        self.selection_changer._push_empty('vertex', kwargs)

    def edge_selection(self, **kwargs):
        self.selection_changer._push_empty('edge', kwargs)

    def vertex(self, id, **kwargs):
        self.graph_changer._send_vertex(id, kwargs)

    def edge(self, source, target, **kwargs):
        self.graph_changer._send_edge(source, target, kwargs)

    def frame(self, duration, **kwargs):
        self.graph_changer._send_frame(duration, kwargs)


def run(script):
    uid = uuid()
    display(HTML(f'''
        <div id="{uid}"></div>
        <script>{script.format(f"'{uid}'")}</script>
    '''))
    return uid


def open(path, **kwargs):
    file = File(path)
    file._send_settings(kwargs)
    return file


def open_animation(path):
    return AnimationFile(path)


def render(path, aspect=16/9, normalize=True, infinite=False, broker=False):
    if not isinstance(aspect, (int, float)):
        raise TypeError(f'aspect must be an integer or a float')
    if aspect < 0.1 or aspect > 10:
        raise ValueError('aspect must be between 0.1 and 10')
    if not isinstance(normalize, bool):
        raise TypeError('normalize must be a boolean')
    if not isinstance(infinite, bool):
        raise TypeError('infinite must be a boolean')
    if not isinstance(broker, bool):
        raise TypeError('broker must be a boolean')
    normalizeJS = str(normalize).lower()
    infiniteJS = str(infinite).lower()
    brokerJS = str(broker).lower()
    uid = run(f"netpixi.render({{}}, '{path}', {aspect}, {normalizeJS}, {infiniteJS}, {brokerJS});")
    return Render(uid)


display(HTML(f'''
    <script src="/files/netpixi.min.js"></script>
'''))
