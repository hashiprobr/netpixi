import json
import gzip

from shortuuid import uuid
from IPython.core.display import display, HTML


class ZipNet:
    def _push(self, type, data, props):
        for key, value in data.items():
            if not isinstance(value, str):
                raise TypeError(f'{type} {key} must be a string')
        data['type'] = type
        if props is not None and not isinstance(props, dict):
            raise TypeError('props must be None or a dictionary')
        if props is not None:
            data['props'] = props
        line = f'{json.dumps(data)}\n'
        self.file.write(line.encode())

    def __init__(self, path, props):
        self.file = gzip.open(path, 'wb')
        self._push('settings', {}, props)

    def __enter__(self):
        return self

    def write_vertex(self, id, props=None):
        self._push('vertex', {'id': id}, props)

    def write_edge(self, source, target, props=None):
        self._push('edge', {'source': source, 'target': target}, props)

    def __exit__(self, exc_type, exc_value, traceback):
        self.file.close()


def open(path, props=None):
    return ZipNet(path, props)


def render(path, horizontal=16, vertical=9, normalize=False, broker=False):
    uid = uuid()
    display(HTML(f'''
        <div id="{uid}"></div>
        <script>netpixi(\'{path}\', {horizontal}, {vertical}, \'{normalize}\', \'{broker}\', \'{uid}\');</script>
    '''))


display(HTML(f'''
    <script src="/files/netpixi.min.js"></script>
'''))
