import json
import gzip

from shortuuid import uuid
from IPython.core.display import display, HTML


class ZipNet:
    def _load(self, type, props):
        if props is None or isinstance(props, dict):
            data = {}
            data['type'] = type
            if props is not None:
                data['props'] = props
            return data
        raise TypeError('props must be None or a dict')

    def _dump(self, data):
        line = f'{json.dumps(data)}\n'
        self.file.write(line.encode())

    def __init__(self, path, props):
        self.file = gzip.open(path, 'wb')
        data = self._load('settings', props)
        self._dump(data)

    def __enter__(self):
        return self

    def write_vertex(self, id, props=None):
        data = self._load('vertex', props)
        data['id'] = id
        self._dump(data)

    def write_edge(self, source, target, props=None):
        data = self._load('edge', props)
        data['source'] = source
        data['target'] = target
        self._dump(data)

    def __exit__(self, exc_type, exc_value, traceback):
        self.file.close()


def open(path, props=None):
    return ZipNet(path, props)


def render(path, horizontal=16, vertical=9, fine=False):
    fineJS = str(fine).lower()
    uid = uuid()
    display(HTML(f'''
        <div id="{uid}"></div>
        <script>window.netpixi(\'{uid}\', \'{path}\', {horizontal}, {vertical}, {fineJS});</script>
    '''))


display(HTML(f'''
    <script src="/files/netpixi.min.js"></script>
'''))
