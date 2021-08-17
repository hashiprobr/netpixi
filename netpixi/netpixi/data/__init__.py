import json
import gzip

from json.decoder import JSONDecodeError

from abc import ABC, abstractmethod


class Loader(ABC):
    def _raise(self, Class, message):
        raise Class(f'Line {self.i}: {message}')

    def _pop(self, data, key):
        if key in data:
            value = data.pop(key)
            if isinstance(value, (int, str)):
                return value
            self._raise(TypeError, f'{key} must be an integer or a string')
        self._raise(ValueError, f'missing {key}')

    def load(self, path):
        g = None
        vertices = {}
        edges = {}
        with gzip.open(path) as file:
            for self.i, line in enumerate(file, 1):
                try:
                    data = json.loads(line)
                except JSONDecodeError as error:
                    self._raise(ValueError, error.msg)
                if not isinstance(data, dict):
                    self._raise(TypeError, 'must be a dictionary')

                props = data.pop('props', None)
                if props is not None and not isinstance(props, dict):
                    self._raise(TypeError, 'props must be None or a dictionary')

                type = data.get('type')
                if type == 'settings':
                    if g is None:
                        directed = False
                        if isinstance(props, dict):
                            settings = props.get('graph')
                            if isinstance(settings, dict):
                                value = settings.get('directed')
                                if isinstance(value, bool):
                                    directed = value
                        g = self.process_settings(directed, props)
                    else:
                        self._raise(ValueError, 'duplicate settings')
                elif type == 'vertex':
                    id = self._pop(data, 'id')
                    if id in vertices:
                        self._raise(ValueError, f'duplicate vertex with id {id}')
                    vertices[id] = props
                elif type == 'edge':
                    source = self._pop(data, 'source')
                    if source not in vertices:
                        self._raise(ValueError, f'missing source with id {source}')
                    target = self._pop(data, 'target')
                    if target not in vertices:
                        self._raise(ValueError, f'missing target with id {target}')
                    if source == target:
                        self._raise(ValueError, 'source and target with same id')
                    if (source, target) in edges:
                        self._raise(ValueError, f'duplicate edge with source {source} and target {target}')
                    if g is None:
                        self._raise(ValueError, 'missing settings')
                    if not directed and (target, source) in edges:
                        self._raise(ValueError, f'existing edge with source {target} and target {source} but graph is not directed')
                    edges[source, target] = props
                else:
                    self._raise(ValueError, 'unknown type')
        if g is None:
            g = self.process_settings(False, None)
        for id, props in vertices.items():
            self.process_vertex(g, id, props)
        for (source, target), props in edges.items():
            self.process_edge(g, source, target, props)
        return g

    @abstractmethod
    def process_settings(self, directed, props):
        pass

    @abstractmethod
    def process_vertex(self, g, id, props):
        pass

    @abstractmethod
    def process_edge(self, g, source, target, props):
        pass


class Saver(ABC):
    def _write(self, type, data, props, file):
        data['type'] = type
        if props:
            data['props'] = props
        line = f'{json.dumps(data)}\n'
        file.write(line.encode())

    def save(self, g, path):
        self.validate(g)
        with gzip.open(path, 'w') as file:
            data, props = self.settings(g)
            self._write('settings', data, props, file)
            for data, props in self.vertices(g):
                self._write('vertex', data, props, file)
            for data, props in self.edges(g):
                self._write('edge', data, props, file)

    @abstractmethod
    def validate(self, g):
        pass

    @abstractmethod
    def settings(self, g):
        pass

    @abstractmethod
    def vertices(self, g):
        pass

    @abstractmethod
    def edges(self, g):
        pass


def load(Class, path):
    loader = Class()
    return loader.load(path)


def save(Class, g, path):
    saver = Class()
    saver.save(g, path)
